from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from typing import List, Dict
from supabase import Client
from app.core.security import get_current_user, get_authed_supabase_client
from app.services.google_maps_service import autocomplete_address, geocode_address, get_place_details
import pytesseract
from PIL import Image
import io

router = APIRouter(prefix="/services", tags=["services"])


@router.get("/geocode/autocomplete")
async def geocode_autocomplete(
    input: str = Query(..., min_length=1),
    lat: float = Query(None),
    lng: float = Query(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    location = (lat, lng) if lat and lng else None
    
    try:
        results = await autocomplete_address(input, location)
        return {"predictions": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geocoding failed: {str(e)}")


@router.get("/geocode/details")
async def get_geocode_details(
    place_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        result = await get_place_details(place_id)
        
        if not result or 'result' not in result:
            raise HTTPException(status_code=404, detail="Place not found")
        
        place = result['result']
        location = place['geometry']['location']
        
        return {
            "address": place.get('formatted_address', ''),
            "latitude": location['lat'],
            "longitude": location['lng'],
            "place_id": place['place_id']
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get place details: {str(e)}")


@router.get("/geocode/address")
async def geocode_address_endpoint(
    address: str = Query(..., min_length=3),
    current_user: dict = Depends(get_current_user)
):
    """Geocode a raw address string to coordinates."""
    try:
        result = await geocode_address(address)
        
        if not result or len(result) == 0:
            raise HTTPException(status_code=404, detail="Address not found")
        
        first_result = result[0]
        location = first_result['geometry']['location']
        
        return {
            "formatted_address": first_result.get('formatted_address', address),
            "latitude": location['lat'],
            "longitude": location['lng'],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geocoding failed: {str(e)}")


def parse_contact_from_ocr(text: str) -> dict:
    """Parse name, phone number from OCR text."""
    import re
    
    lines = [re.sub(r'\s+', ' ', line).strip() for line in text.split('\n') if line.strip()]
    
    phone_patterns = [
        r'(?:\+33|0033|0)\s*[1-9](?:[\s.\-]*\d{2}){4}',
        r'(?:\+\d{1,3}[\s.\-]?)?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}',
    ]
    
    phone_number = None
    for pattern in phone_patterns:
        for line in lines:
            match = re.search(pattern, line)
            if match:
                raw_phone = match.group(0)
                cleaned = re.sub(r'[\s.\-()]', '', raw_phone)
                if len(cleaned) >= 10:
                    if cleaned.startswith('0') and len(cleaned) == 10:
                        phone_number = '+33' + cleaned[1:]
                    elif cleaned.startswith('33') and len(cleaned) == 11:
                        phone_number = '+' + cleaned
                    elif cleaned.startswith('+'):
                        phone_number = cleaned
                    else:
                        phone_number = cleaned
                    break
        if phone_number:
            break
    
    first_name = None
    last_name = None
    
    name_candidates = []
    for line in lines:
        if phone_number and re.sub(r'[\s.\-()]', '', line).find(re.sub(r'[\s.\-+]', '', phone_number or '')) != -1:
            continue
        if re.search(r'\d{5}', line):
            continue
        if any(kw in line.lower() for kw in ['rue', 'avenue', 'bd', 'boulevard', 'chemin', 'route', 'impasse', 'allée', 'place']):
            continue
        
        words = line.split()
        if 2 <= len(words) <= 4:
            all_alpha = all(re.match(r'^[A-Za-zÀ-ÿ\-\']+$', w) for w in words)
            has_capital = any(w[0].isupper() for w in words if w)
            if all_alpha and has_capital:
                name_candidates.append(words)
    
    if name_candidates:
        best = name_candidates[0]
        if len(best) >= 2:
            first_name = best[0].capitalize()
            last_name = ' '.join(best[1:]).upper()
    
    return {
        'first_name': first_name,
        'last_name': last_name,
        'phone_number': phone_number
    }


@router.post("/ocr/scan-address")
async def scan_address_ocr(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        from PIL import ImageOps, ImageEnhance, ImageFilter
        import re

        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image = ImageOps.exif_transpose(image)

        gray_base = image.convert('L')
        variants = []
        variants.append(gray_base)
        v1 = ImageEnhance.Contrast(gray_base).enhance(2.0)
        v1 = ImageEnhance.Sharpness(v1).enhance(1.5)
        v1 = v1.filter(ImageFilter.MedianFilter(size=3))
        variants.append(v1)
        variants.append(v1.point(lambda x: 0 if x < 160 else 255, '1'))
        variants.append(v1.point(lambda x: 0 if x < 190 else 255, '1'))

        try:
            langs = pytesseract.get_languages(config='')
        except Exception:
            langs = []

        lang = 'fra' if 'fra' in langs else 'eng'
        psms = [6, 4, 11]

        def score_text(t: str) -> int:
            if not t:
                return 0
            return len(re.findall(r'[A-Za-zÀ-ÿ0-9]', t))

        best_text = ''
        best_score = 0
        for variant in variants:
            for psm in psms:
                cfg = f'--oem 1 --psm {psm}'
                try:
                    t = pytesseract.image_to_string(variant, lang=lang, config=cfg)
                except Exception:
                    continue
                s = score_text(t)
                if s > best_score:
                    best_score = s
                    best_text = t

        text = best_text
        
        contact_info = parse_contact_from_ocr(text)

        lines = [re.sub(r'\s+', ' ', line).strip() for line in text.split('\n') if line.strip()]

        street_keywords = (
            'rue', 'avenue', 'av', 'bd', 'boulevard', 'impasse', 'chemin', 'route',
            'allée', 'allee', 'place', 'quai', 'cours', 'square', 'lot', 'bat',
            'bât', 'batiment', 'bâtiment'
        )

        scored = []
        for line in lines:
            l = line.lower()
            score = 0
            if any(k in l for k in street_keywords):
                score += 2
            if re.search(r'\b\d{5}\b', l):
                score += 2
            if re.search(r'\b\d{1,4}\b', l):
                score += 1
            scored.append((score, line))

        scored.sort(key=lambda x: x[0], reverse=True)
        candidates = [s[1] for s in scored if s[0] > 0]
        if not candidates:
            candidates = lines[:5]

        joined_candidates = []
        for i in range(min(5, len(candidates))):
            joined_candidates.append(candidates[i])
        for i in range(min(4, len(candidates) - 1)):
            joined_candidates.append(f"{candidates[i]} {candidates[i+1]}")
        for i in range(min(3, len(candidates) - 2)):
            joined_candidates.append(f"{candidates[i]} {candidates[i+1]} {candidates[i+2]}")

        seen = set()
        unique_candidates = []
        for c in joined_candidates:
            cc = re.sub(r'\s+', ' ', c).strip()
            if not cc:
                continue
            key = cc.lower()
            if key in seen:
                continue
            seen.add(key)
            unique_candidates.append(cc)

        geocode_result = None
        tried = []
        for candidate in unique_candidates[:8]:
            tried.append(candidate)
            geocode_result = await geocode_address(candidate)
            if geocode_result:
                break

        if geocode_result:
            location = geocode_result['geometry']['location']
            return {
                "success": True,
                "raw_text": text,
                "candidates": tried,
                "extracted_address": geocode_result['formatted_address'],
                "latitude": location['lat'],
                "longitude": location['lng'],
                "first_name": contact_info['first_name'],
                "last_name": contact_info['last_name'],
                "phone_number": contact_info['phone_number']
            }

        return {
            "success": False,
            "raw_text": text,
            "candidates": tried,
            "first_name": contact_info['first_name'],
            "last_name": contact_info['last_name'],
            "phone_number": contact_info['phone_number'],
            "message": "Could not geocode extracted text" if best_score > 0 else "No text detected in image"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@router.post("/speech/recognize")
async def recognize_speech(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    try:
        from google.cloud import speech
        from google.auth.exceptions import DefaultCredentialsError

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio file")

        if content[:4] != b'RIFF':
            raise HTTPException(status_code=400, detail="Audio must be WAV (RIFF) encoded LINEAR16 16kHz")

        try:
            client = speech.SpeechClient()
        except DefaultCredentialsError:
            raise HTTPException(
                status_code=501,
                detail="Google Cloud Speech-to-Text credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS."
            )

        audio = speech.RecognitionAudio(content=content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code="fr-FR",
        )

        response = client.recognize(config=config, audio=audio)
        
        if not response.results:
            return {
                "success": False,
                "message": "No speech detected"
            }
        
        transcript = response.results[0].alternatives[0].transcript
        
        return {
            "success": True,
            "transcript": transcript,
            "confidence": response.results[0].alternatives[0].confidence
        }
    
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="Google Cloud Speech-to-Text not configured. Please set up credentials."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech recognition failed: {str(e)}")
