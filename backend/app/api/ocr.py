"""
OCR API Endpoints
Handles OCR text validation with spaCy NER + Google Maps
"""

import time
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.address_validation_service import (
    validate_ocr_address,
    SPACY_AVAILABLE
)

router = APIRouter(prefix="/ocr", tags=["OCR"])

# OCR dedicated logger
ocr_logger = logging.getLogger("ocr_workflow")
ocr_logger.setLevel(logging.INFO)
if not ocr_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "[OCR-API] %(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S"
    ))
    ocr_logger.addHandler(handler)


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class OCRValidationRequest(BaseModel):
    """Request body for OCR validation"""
    raw_text: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None


class ValidationResult(BaseModel):
    """Validation result details"""
    is_valid: bool
    confidence: float
    source: str
    spacy_used: bool = False


class AddressResult(BaseModel):
    """Validated address details"""
    street: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    formatted: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_id: Optional[str] = None


class ContactResult(BaseModel):
    """Contact information"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None


class EntitiesExtracted(BaseModel):
    """Entities extracted by spaCy NER"""
    recipient_name: Optional[str] = None
    company_name: Optional[str] = None
    address_guess: Optional[str] = None
    phone: Optional[str] = None


class OCRValidationResponse(BaseModel):
    """Response body for OCR validation"""
    validation: ValidationResult
    address: AddressResult
    contact: ContactResult
    entities_extracted: Optional[EntitiesExtracted] = None
    raw_input: str


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/validate-address", response_model=OCRValidationResponse)
async def validate_address(request: OCRValidationRequest) -> OCRValidationResponse:
    """
    Validate and parse an address from OCR text.
    
    Workflow:
    1. spaCy NER: Extract entities (name, company, location, phone)
    2. Google Maps: Validate and clean the address
    3. Return: Structured, validated data with coordinates
    
    This endpoint should be called after ML Kit detects text with confidence >= 0.3
    """
    start_time = time.perf_counter()
    
    # Log incoming request
    text_preview = request.raw_text[:60].replace('\n', ' ')
    ocr_logger.info(f"📥 REQUEST | len={len(request.raw_text)} | spacy={SPACY_AVAILABLE} | \"{text_preview}...\"")
    
    if not request.raw_text or len(request.raw_text.strip()) < 5:
        ocr_logger.warning("❌ REJECTED | raw_text too short")
        raise HTTPException(
            status_code=400,
            detail="raw_text must be at least 5 characters"
        )
    
    try:
        # Call validation service (spaCy NER + Google Maps)
        validation_start = time.perf_counter()
        result = await validate_ocr_address(
            raw_text=request.raw_text,
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
            company=request.company
        )
        validation_time = (time.perf_counter() - validation_start) * 1000
        
        # Log validation result
        is_valid = result["validation"]["is_valid"]
        confidence = result["validation"]["confidence"]
        source = result["validation"]["source"]
        spacy_used = result["validation"].get("spacy_used", False)
        total_time = (time.perf_counter() - start_time) * 1000
        
        # Log spaCy entities if found
        entities = result.get("entities_extracted", {})
        if entities.get("recipient_name") or entities.get("address_guess"):
            ocr_logger.info(
                f"🧠 SPACY | name=\"{entities.get('recipient_name', '')}\" | "
                f"addr=\"{entities.get('address_guess', '')[:30]}\" | "
                f"phone=\"{entities.get('phone', '')}\""
            )
        
        ocr_logger.info(
            f"📤 RESPONSE | valid={is_valid} | conf={confidence:.2f} | "
            f"source={source} | spacy={spacy_used} | time={total_time:.0f}ms"
        )
        
        if is_valid:
            addr = result["address"]
            ocr_logger.info(
                f"✅ VALIDATED | street=\"{addr.get('street', '')}\" | "
                f"city=\"{addr.get('city', '')}\" | postal={addr.get('postal_code', '')} | "
                f"lat={addr.get('latitude', 'N/A')}"
            )
        
        return OCRValidationResponse(
            validation=ValidationResult(**result["validation"]),
            address=AddressResult(**result["address"]),
            contact=ContactResult(**result["contact"]),
            entities_extracted=EntitiesExtracted(**result.get("entities_extracted", {})),
            raw_input=result["raw_input"]
        )
        
    except Exception as e:
        total_time = (time.perf_counter() - start_time) * 1000
        ocr_logger.error(f"❌ ERROR | {str(e)} | time={total_time:.0f}ms")
        raise HTTPException(
            status_code=500,
            detail=f"Address validation failed: {str(e)}"
        )


@router.get("/health")
async def ocr_health():
    """Health check for OCR service"""
    return {
        "status": "ok",
        "service": "ocr",
        "spacy_available": SPACY_AVAILABLE
    }
