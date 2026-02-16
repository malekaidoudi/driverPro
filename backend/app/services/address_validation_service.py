"""
Address Validation Service with CamemBERT-NER
Validates and parses addresses using Hugging Face Transformers + Google Address Validation API

Uses Jean-Baptiste/camembert-ner - a lightweight French NER model:
- 40% smaller than full BERT
- 60% faster inference
- 95% accuracy retention
"""

import httpx
import re
import logging
from typing import Dict, Optional, List, Tuple
from pydantic import BaseModel
from app.core.config import get_settings

settings = get_settings()

# Logger dédié
logger = logging.getLogger("address_validation")

# =============================================================================
# NLP MODELS: CamemBERT-NER (Distilled) + spaCy fallback
# =============================================================================

BERT_AVAILABLE = False
SPACY_AVAILABLE = False
ner_pipeline = None
nlp = None

# Try to load CamemBERT-NER (lightweight BERT for French NER)
try:
    from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
    
    MODEL_NAME = "Jean-Baptiste/camembert-ner"
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForTokenClassification.from_pretrained(MODEL_NAME)
    ner_pipeline = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")
    
    BERT_AVAILABLE = True
    logger.info("✅ CamemBERT-NER chargé avec succès (modèle léger ~400MB)")
    
except Exception as e:
    logger.warning(f"⚠️ CamemBERT-NER non disponible: {e}")

# Fallback to spaCy standard model
if not BERT_AVAILABLE:
    try:
        import spacy
        nlp = spacy.load("fr_core_news_lg")
        SPACY_AVAILABLE = True
        logger.info("✅ spaCy fr_core_news_lg chargé (fallback)")
    except Exception as e:
        logger.warning(f"⚠️ spaCy non disponible: {e}")


# =============================================================================
# MODELS
# =============================================================================

class ParsedAddressComponent(BaseModel):
    """Individual address component"""
    street_number: Optional[str] = None
    street_name: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    country: str = "FR"


class ExtractedEntities(BaseModel):
    """Entities extracted by spaCy NER + BERT"""
    recipient_name: Optional[str] = None
    company_name: Optional[str] = None
    address_guess: Optional[str] = None
    phone: Optional[str] = None
    postal_code: Optional[str] = None
    city_guess: Optional[str] = None
    # New: address type classification
    address_type: str = "unknown"  # "company", "individual", "unknown"
    address_type_confidence: float = 0.0


class ValidatedAddress(BaseModel):
    """Result of address validation"""
    is_valid: bool
    confidence: float
    formatted_address: Optional[str] = None
    street: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_id: Optional[str] = None
    validation_source: str = "google"
    raw_input: str = ""


# =============================================================================
# PATTERNS REGEX (fallback si spaCy indisponible)
# =============================================================================

STREET_TYPES = [
    "rue", "avenue", "av", "boulevard", "bd", "place", "allée", "allee",
    "chemin", "impasse", "passage", "route", "voie", "cours", "square",
    "lotissement", "residence", "résidence", "quai", "parvis"
]

POSTAL_CODE_PATTERN = re.compile(r'\b(\d{5})\b')
STREET_NUMBER_PATTERN = re.compile(r'^\s*(\d+(?:\s*(?:bis|ter|quater|[a-z]))?)\s*[,\s]', re.IGNORECASE)
PHONE_PATTERN = re.compile(r'\b(0[1-9](?:[\s.-]?\d{2}){4})\b')


# =============================================================================
# SPACY NER EXTRACTION
# =============================================================================

# Company indicators for classification
COMPANY_INDICATORS = [
    "sarl", "sas", "sa", "eurl", "sasu", "snc", "scp", "sci",
    "entreprise", "société", "societe", "ets", "établissements", "etablissements",
    "groupe", "holding", "international", "france", "services",
    "magasin", "boutique", "restaurant", "hotel", "hôtel", "cafe", "café",
    "pharmacie", "garage", "auto", "pressing", "coiffure", "salon",
    "boulangerie", "patisserie", "pâtisserie", "supermarché", "supermarche",
    "carrefour", "leclerc", "intermarché", "auchan", "lidl", "aldi",
    "cabinet", "agence", "bureau", "atelier", "usine", "entrepôt", "entrepot",
    "centre", "clinique", "laboratoire", "labo", "institut",
    "lycée", "lycee", "collège", "college", "école", "ecole", "université", "universite",
    "mairie", "préfecture", "prefecture", "tribunal", "police", "gendarmerie",
    "hôpital", "hopital", "ehpad", "maison de retraite",
    "association", "fondation", "ong",
    "@ ", ".com", ".fr", "www.",
]

INDIVIDUAL_INDICATORS = [
    "mr", "mr.", "mme", "mme.", "m.", "mlle", "madame", "monsieur",
    "chez", "famille", "domicile",
]


def classify_address_type(text: str, has_person: bool, has_org: bool) -> tuple[str, float]:
    """
    Classify if address is for a company or individual.
    Returns (type, confidence)
    """
    text_lower = text.lower()
    
    company_score = 0.0
    individual_score = 0.0
    
    # Check indicators
    for indicator in COMPANY_INDICATORS:
        if indicator in text_lower:
            company_score += 0.3
    
    for indicator in INDIVIDUAL_INDICATORS:
        if indicator in text_lower:
            individual_score += 0.4
    
    # NER-based scoring
    if has_org:
        company_score += 0.5
    if has_person:
        individual_score += 0.3
    
    # Both person and org = likely company with contact person
    if has_person and has_org:
        company_score += 0.2
    
    # Cap scores
    company_score = min(company_score, 1.0)
    individual_score = min(individual_score, 1.0)
    
    if company_score > individual_score and company_score > 0.3:
        return "company", company_score
    elif individual_score > company_score and individual_score > 0.3:
        return "individual", individual_score
    else:
        return "unknown", max(company_score, individual_score)


def extract_entities_bert(raw_text: str) -> ExtractedEntities:
    """
    Extract entities using CamemBERT-NER (Hugging Face Transformers).
    Labels: PER (person), ORG (company), LOC (location), MISC (miscellaneous)
    
    This model is:
    - 40% smaller than full BERT
    - 60% faster inference
    - 95% accuracy retention
    """
    entities = ExtractedEntities()
    
    if not ner_pipeline:
        return extract_entities_regex(raw_text)
    
    try:
        # Run NER pipeline
        ner_results = ner_pipeline(raw_text)
        
        locations = []
        has_person = False
        has_org = False
        
        for ent in ner_results:
            label = ent.get("entity_group", "")
            text = ent.get("word", "").strip()
            
            if label == "PER":
                has_person = True
                if not entities.recipient_name:
                    entities.recipient_name = text
            elif label == "ORG":
                has_org = True
                if not entities.company_name:
                    entities.company_name = text
            elif label == "LOC":
                locations.append(text)
        
        # Combine location entities as address guess
        if locations:
            entities.address_guess = " ".join(locations)
            if len(locations) > 1:
                entities.city_guess = locations[-1]
        
        # Classify address type (company vs individual)
        addr_type, addr_confidence = classify_address_type(raw_text, has_person, has_org)
        entities.address_type = addr_type
        entities.address_type_confidence = addr_confidence
        
        logger.info(f"[NER] CamemBERT-NER: PER={has_person}, ORG={has_org}, "
                    f"Type={addr_type} ({addr_confidence:.0%})")
        
    except Exception as e:
        logger.error(f"[NER] CamemBERT error: {e}")
        return extract_entities_regex(raw_text)
    
    # Extract postal code with regex (NER doesn't detect numbers well)
    postal_match = POSTAL_CODE_PATTERN.search(raw_text)
    if postal_match:
        entities.postal_code = postal_match.group(1)
    
    # Extract phone with regex
    phone_match = PHONE_PATTERN.search(raw_text.replace(" ", "").replace(".", "").replace("-", ""))
    if phone_match:
        entities.phone = phone_match.group(1)
    
    return entities


def extract_entities_spacy(raw_text: str) -> ExtractedEntities:
    """
    Fallback: Extract entities using spaCy standard model.
    Used when CamemBERT-NER is not available.
    """
    if not SPACY_AVAILABLE or not nlp:
        return extract_entities_regex(raw_text)
    
    entities = ExtractedEntities()
    doc = nlp(raw_text)
    
    locations = []
    has_person = False
    has_org = False
    
    for ent in doc.ents:
        if ent.label_ == "PER":
            has_person = True
            if not entities.recipient_name:
                entities.recipient_name = ent.text.strip()
        elif ent.label_ == "ORG":
            has_org = True
            if not entities.company_name:
                entities.company_name = ent.text.strip()
        elif ent.label_ in ["LOC", "GPE", "FAC"]:
            locations.append(ent.text.strip())
    
    if locations:
        entities.address_guess = " ".join(locations)
        if len(locations) > 1:
            entities.city_guess = locations[-1]
    
    postal_match = POSTAL_CODE_PATTERN.search(raw_text)
    if postal_match:
        entities.postal_code = postal_match.group(1)
    
    phone_match = PHONE_PATTERN.search(raw_text.replace(" ", "").replace(".", "").replace("-", ""))
    if phone_match:
        entities.phone = phone_match.group(1)
    
    addr_type, addr_confidence = classify_address_type(raw_text, has_person, has_org)
    entities.address_type = addr_type
    entities.address_type_confidence = addr_confidence
    
    logger.info(f"[NER] spaCy: Type={addr_type} ({addr_confidence:.0%})")
    
    return entities


def extract_entities(raw_text: str) -> ExtractedEntities:
    """
    Main entry point for entity extraction.
    Uses CamemBERT-NER if available, otherwise falls back to spaCy, then regex.
    """
    if BERT_AVAILABLE:
        return extract_entities_bert(raw_text)
    elif SPACY_AVAILABLE:
        return extract_entities_spacy(raw_text)
    else:
        return extract_entities_regex(raw_text)


def extract_entities_regex(raw_text: str) -> ExtractedEntities:
    """
    Fallback: Extract entities using regex patterns.
    """
    entities = ExtractedEntities()
    text = raw_text.strip()
    
    # Postal code
    postal_match = POSTAL_CODE_PATTERN.search(text)
    if postal_match:
        entities.postal_code = postal_match.group(1)
    
    # Phone
    phone_clean = text.replace(" ", "").replace(".", "").replace("-", "")
    phone_match = PHONE_PATTERN.search(phone_clean)
    if phone_match:
        entities.phone = phone_match.group(1)
    
    # Address guess: look for street type patterns
    text_lower = text.lower()
    for street_type in STREET_TYPES:
        pattern = rf'(\d+(?:\s*(?:bis|ter|quater|[a-z]))?\s*)?{street_type}\s+[^\n,]+'
        match = re.search(pattern, text_lower)
        if match:
            entities.address_guess = match.group(0).strip()
            break
    
    return entities


def extract_local_address(raw_text: str) -> ParsedAddressComponent:
    """
    Local parsing of address without API call.
    """
    text = raw_text.strip()
    result = ParsedAddressComponent()
    
    postal_match = POSTAL_CODE_PATTERN.search(text)
    if postal_match:
        result.postal_code = postal_match.group(1)
    
    number_match = STREET_NUMBER_PATTERN.match(text)
    if number_match:
        result.street_number = number_match.group(1).strip()
    
    text_lower = text.lower()
    for street_type in STREET_TYPES:
        pattern = rf'\b({street_type})\s+([^,\n\d]+)'
        match = re.search(pattern, text_lower)
        if match:
            street_name = match.group(0).strip()
            result.street_name = ' '.join(w.capitalize() for w in street_name.split())
            break
    
    return result


async def validate_address_google(raw_address: str) -> ValidatedAddress:
    """
    Validate address using Google Address Validation API.
    Falls back to Geocoding API if Address Validation is not available.
    """
    api_key = settings.google_maps_api_key
    
    # First try Google Address Validation API (more accurate)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Google Address Validation API
            validation_url = "https://addressvalidation.googleapis.com/v1:validateAddress"
            
            payload = {
                "address": {
                    "addressLines": [raw_address],
                    "regionCode": "FR"
                },
                "enableUspsCass": False
            }
            
            response = await client.post(
                f"{validation_url}?key={api_key}",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                return _parse_validation_response(data, raw_address)
            
    except Exception as e:
        print(f"[AddressValidation] Google Validation API error: {e}")
    
    # Fallback to Geocoding API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
            
            params = {
                "address": raw_address,
                "region": "fr",
                "language": "fr",
                "key": api_key
            }
            
            response = await client.get(geocode_url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                return _parse_geocode_response(data, raw_address)
                
    except Exception as e:
        print(f"[AddressValidation] Geocoding API error: {e}")
    
    # Final fallback: local parsing
    return _local_fallback(raw_address)


def _parse_validation_response(data: Dict, raw_input: str) -> ValidatedAddress:
    """Parse Google Address Validation API response"""
    result = data.get("result", {})
    verdict = result.get("verdict", {})
    address = result.get("address", {})
    geocode = result.get("geocode", {})
    
    # Determine confidence based on verdict
    address_complete = verdict.get("addressComplete", False)
    has_unconfirmed = verdict.get("hasUnconfirmedComponents", True)
    
    if address_complete and not has_unconfirmed:
        confidence = 0.95
    elif address_complete:
        confidence = 0.80
    else:
        confidence = 0.50
    
    # Extract components
    components = address.get("addressComponents", [])
    street_number = ""
    street_name = ""
    postal_code = ""
    city = ""
    
    for comp in components:
        comp_type = comp.get("componentType", "")
        text = comp.get("componentName", {}).get("text", "")
        
        if comp_type == "street_number":
            street_number = text
        elif comp_type == "route":
            street_name = text
        elif comp_type == "postal_code":
            postal_code = text
        elif comp_type == "locality":
            city = text
    
    # Build street
    street = f"{street_number} {street_name}".strip() if street_number else street_name
    
    # Get coordinates
    location = geocode.get("location", {})
    lat = location.get("latitude")
    lng = location.get("longitude")
    
    return ValidatedAddress(
        is_valid=address_complete,
        confidence=confidence,
        formatted_address=address.get("formattedAddress"),
        street=street,
        postal_code=postal_code,
        city=city,
        latitude=lat,
        longitude=lng,
        place_id=geocode.get("placeId"),
        validation_source="google",
        raw_input=raw_input
    )


def _parse_geocode_response(data: Dict, raw_input: str) -> ValidatedAddress:
    """Parse Google Geocoding API response"""
    results = data.get("results", [])
    
    if not results:
        return _local_fallback(raw_input)
    
    result = results[0]
    components = result.get("address_components", [])
    geometry = result.get("geometry", {})
    
    street_number = ""
    street_name = ""
    postal_code = ""
    city = ""
    
    for comp in components:
        types = comp.get("types", [])
        text = comp.get("long_name", "")
        
        if "street_number" in types:
            street_number = text
        elif "route" in types:
            street_name = text
        elif "postal_code" in types:
            postal_code = text
        elif "locality" in types:
            city = text
    
    street = f"{street_number} {street_name}".strip() if street_number else street_name
    
    location = geometry.get("location", {})
    location_type = geometry.get("location_type", "")
    
    # Confidence based on location type
    confidence_map = {
        "ROOFTOP": 0.95,
        "RANGE_INTERPOLATED": 0.85,
        "GEOMETRIC_CENTER": 0.70,
        "APPROXIMATE": 0.50
    }
    confidence = confidence_map.get(location_type, 0.60)
    
    return ValidatedAddress(
        is_valid=True,
        confidence=confidence,
        formatted_address=result.get("formatted_address"),
        street=street,
        postal_code=postal_code,
        city=city,
        latitude=location.get("lat"),
        longitude=location.get("lng"),
        place_id=result.get("place_id"),
        validation_source="google",
        raw_input=raw_input
    )


def _local_fallback(raw_input: str) -> ValidatedAddress:
    """Local parsing fallback when APIs fail"""
    local = extract_local_address(raw_input)
    
    street = ""
    if local.street_number and local.street_name:
        street = f"{local.street_number} {local.street_name}"
    elif local.street_name:
        street = local.street_name
    
    return ValidatedAddress(
        is_valid=bool(local.postal_code or local.street_name),
        confidence=0.40,  # Low confidence for local parsing
        formatted_address=None,
        street=street,
        postal_code=local.postal_code,
        city=local.city,
        latitude=None,
        longitude=None,
        place_id=None,
        validation_source="local",
        raw_input=raw_input
    )


async def validate_ocr_address(
    raw_text: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    phone: Optional[str] = None,
    company: Optional[str] = None
) -> Dict:
    """
    Main entry point for OCR address validation.
    
    Workflow:
    1. spaCy NER: Extract entities (name, company, location)
    2. Google Maps: Validate and clean the address
    3. Return: Structured, validated data
    """
    # ==========================================================================
    # STEP 1: NER - Extract entities (CamemBERT-NER > spaCy > regex)
    # ==========================================================================
    entities = extract_entities(raw_text)
    
    logger.info(f"[NER] Extracted: name={entities.recipient_name}, "
                f"company={entities.company_name}, addr={entities.address_guess}, "
                f"type={entities.address_type}")
    
    # Use spaCy-extracted values as defaults if not provided
    final_name = first_name
    final_last_name = last_name
    final_phone = phone or entities.phone
    final_company = company or entities.company_name
    
    # If spaCy found a full name, try to split it
    if entities.recipient_name and not first_name:
        name_parts = entities.recipient_name.split()
        if len(name_parts) >= 2:
            final_name = name_parts[0]
            final_last_name = " ".join(name_parts[1:])
        else:
            final_last_name = entities.recipient_name
    
    # ==========================================================================
    # STEP 2: GOOGLE MAPS - Validate address
    # ==========================================================================
    # Build address query from spaCy extraction or raw text
    address_query = entities.address_guess or raw_text
    
    # Add postal code if found and not already in address
    if entities.postal_code and entities.postal_code not in address_query:
        address_query = f"{address_query} {entities.postal_code}"
    
    validated = await validate_address_google(address_query)
    
    # ==========================================================================
    # STEP 3: RETURN - Structured response
    # ==========================================================================
    return {
        "validation": {
            "is_valid": validated.is_valid,
            "confidence": validated.confidence,
            "source": validated.validation_source,
            "spacy_used": SPACY_AVAILABLE,
            "bert_used": BERT_AVAILABLE,
        },
        "address": {
            "street": validated.street,
            "postal_code": validated.postal_code or entities.postal_code,
            "city": validated.city or entities.city_guess,
            "formatted": validated.formatted_address,
            "latitude": validated.latitude,
            "longitude": validated.longitude,
            "place_id": validated.place_id,
        },
        "address_type": {
            "type": entities.address_type,  # "company", "individual", "unknown"
            "confidence": entities.address_type_confidence,
            "is_company": entities.address_type == "company",
        },
        "contact": {
            "first_name": final_name,
            "last_name": final_last_name,
            "phone": final_phone,
            "company": final_company,
        },
        "entities_extracted": {
            "recipient_name": entities.recipient_name,
            "company_name": entities.company_name,
            "address_guess": entities.address_guess,
            "phone": entities.phone,
        },
        "raw_input": raw_text
    }
