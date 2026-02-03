/**
 * useOCRParsing - Production-ready OCR text parsing
 * 
 * ROBUST PARSING FOR FRENCH ADDRESSES:
 * 1. Extract postal code + city (most reliable anchor)
 * 2. Extract street (with number and type keyword)
 * 3. Extract phone number
 * 4. Extract name (remaining lines)
 * 5. Combine into full address
 * 
 * Optimized for French delivery labels
 * 
 * PERFORMANCE: Set DEBUG_OCR=false for production (removes log)
 */

// ============================================================================
// PERFORMANCE FLAGS
// ============================================================================
const DEBUG_OCR = true; // Force logs ON for debugging precision issues

// Optimized logging function (no-op in production)
const log: (...args: any[]) => void = DEBUG_OCR ? console.log.bind(console) : () => { };

export interface ParsedOCRData {
    address: string | null;        // Full combined address
    street: string | null;         // Street line (e.g., "20 Avenue Maréchal Foch")
    postalCode: string | null;     // Postal code (e.g., "69230")
    city: string | null;           // City name (e.g., "Saint-Genis-Laval")
    addressAnnex: string | null;   // Bâtiment, villa, lotissement, etc.
    phoneNumber: string | null;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;    // Nom de société/commerce
    isCompany: boolean;            // true si personne morale détectée
    confidence: number;
    rawText: string;               // For debugging
}

// ============================================================================
// CONSTANTS
// ============================================================================

// French phone patterns (strict)
const PHONE_PATTERNS = [
    /(?:\+33|0033)\s*[1-9](?:[\s.\-]?\d{2}){4}/g,  // International +33
    /0\s*[1-9](?:[\s.\-]?\d{2}){4}/g,               // National 0X XX XX XX XX
];

// French postal code (5 digits, starts with valid department)
const POSTAL_CODE_REGEX = /\b(0[1-9]|[1-8]\d|9[0-5]|97[1-6])\d{3}\b/;

// Company legal forms (French)
const COMPANY_LEGAL_FORMS = [
    'sarl', 'sas', 'sasu', 'eurl', 'sa', 'sci', 'snc', 'scp', 'scop', 'gie',
    'earl', 'gaec', 'selarl', 'selas', 'selafa', 'auto-entrepreneur', 'ae',
    'ei', 'eirl', 'micro-entreprise',
];

// Company/business type keywords
const COMPANY_KEYWORDS = [
    // Formes juridiques
    ...COMPANY_LEGAL_FORMS,
    // Types de commerces
    'restaurant', 'brasserie', 'café', 'cafe', 'bar', 'bistrot',
    'boulangerie', 'pâtisserie', 'patisserie', 'traiteur',
    'pharmacie', 'parapharmacie', 'laboratoire', 'labo',
    'garage', 'carrosserie', 'concession', 'auto',
    'hôtel', 'hotel', 'gîte', 'gite', 'camping',
    'coiffure', 'salon', 'institut', 'spa', 'beauté', 'beaute',
    'supermarché', 'supermarche', 'épicerie', 'epicerie', 'magasin', 'boutique', 'shop', 'store',
    'cabinet', 'clinique', 'centre', 'agence',
    'atelier', 'usine', 'entrepôt', 'entrepot', 'dépôt', 'depot',
    'banque', 'assurance', 'mutuelle',
    'école', 'ecole', 'lycée', 'lycee', 'collège', 'college', 'université', 'universite',
    'mairie', 'préfecture', 'prefecture', 'tribunal',
    // Mots génériques
    'entreprise', 'société', 'societe', 'ets', 'établissement', 'etablissement',
    'cie', 'compagnie', 'group', 'groupe', 'holding',
    'association', 'fondation', 'fédération', 'federation',
];

// Address type keywords (French) - weighted by specificity
const ADDRESS_KEYWORDS_HIGH = ['rue', 'avenue', 'boulevard', 'allée', 'impasse', 'chemin'];
const ADDRESS_KEYWORDS_MEDIUM = ['av', 'bd', 'bld', 'place', 'route', 'passage', 'square', 'cours', 'quai', 'voie', 'résidence', 'lotissement'];

// Words that EXCLUDE a line from being a name
const NAME_EXCLUSION_WORDS = [
    ...ADDRESS_KEYWORDS_HIGH,
    ...ADDRESS_KEYWORDS_MEDIUM,
    'france', 'cedex', 'bp', 'cs', 'tel', 'tél', 'téléphone', 'mobile', 'fax',
    'email', 'mail', 'www', 'http', 'livraison', 'expéditeur', 'destinataire',
    'colis', 'commande', 'ref', 'référence', 'n°', 'numéro',
];

// Address annex keywords (bâtiment, villa, lotissement, etc.)
const ANNEX_KEYWORDS = [
    'bât', 'bat', 'bâtiment', 'batiment', 'building',
    'appt', 'apt', 'appartement', 'apartment', 'appart', 'bureau', 'bureaux', 'office', 'offices',
    'villa', 'maison', 'chateau', 'château', 'immeuble', 'imm',
    'lot', 'lotissement',
    'résidence', 'residence', 'rés', 'res',
    'entrée', 'entree', 'ent',
    'escalier', 'esc',
    'étage', 'etage',
    'porte', 'pte',
    'bloc', 'block',
    'tour', 'tower',
    'pavillon', 'pav',
    'hameau',
    'lieu-dit', 'lieudit', 'ld',
    'zone', 'za', 'zi', 'zac',
    'digicode', 'code', 'interphone',
];

// Common French first names (extended list for better detection)
const COMMON_FIRST_NAMES = new Set([
    // Male
    'jean', 'pierre', 'michel', 'philippe', 'alain', 'patrick', 'nicolas',
    'christophe', 'david', 'laurent', 'thomas', 'julien', 'eric', 'éric',
    'françois', 'francois', 'frédéric', 'frederic', 'olivier', 'pascal',
    'bruno', 'didier', 'stéphane', 'stephane', 'thierry', 'bernard',
    'jacques', 'daniel', 'marc', 'paul', 'louis', 'antoine', 'alexandre',
    'maxime', 'lucas', 'hugo', 'théo', 'theo', 'nathan', 'léo', 'leo',
    'mohamed', 'ahmed', 'karim', 'mehdi', 'youssef', 'omar', 'ali', 'malek', 'amine', 'khalid', 'rachid', 'said', 'nabil',
    // Female
    'marie', 'sophie', 'nathalie', 'isabelle', 'catherine', 'sylvie', 'anne',
    'christine', 'monique', 'françoise', 'francoise', 'valérie', 'valerie',
    'sandrine', 'céline', 'celine', 'véronique', 'veronique', 'patricia',
    'martine', 'julie', 'camille', 'léa', 'lea', 'emma', 'chloé', 'chloe',
    'sarah', 'laura', 'manon', 'océane', 'oceane', 'fatima', 'amina',
    'fabienne', 'corinne', 'brigitte', 'dominique', 'florence', 'laurence',
    'stéphanie', 'stephanie', 'aurélie', 'aurelie', 'elodie', 'mélanie', 'melanie',
    // OCR variations and additional names
    'tarienne', 'fabienne', 'adrienne', 'vivienne', 'etienne', 'julienne',
    'christiane', 'mariane', 'marianne', 'suzanne', 'jeanne', 'liliane',
    'renne', 'lansard', 'langard', 'landard', // Common OCR errors for names
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize OCR text: fix common OCR errors, normalize whitespace
 */
function normalizeText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ') // Unicode spaces
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Split text into lines, preserving original line breaks
 */
function splitLines(text: string): string[] {
    return text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
}

/**
 * Clean city name: remove country names, garbage text, normalize
 */
function cleanCityName(rawCity: string): string | null {
    if (!rawCity) return null;

    let city = rawCity.trim();

    // Remove common trailing garbage (country names, OCR artifacts)
    const trailingGarbage = [
        /\s+FRANCE\b.*$/i,
        /\s+FRA\b.*$/i,
        /\s+FR\b.*$/i,
        /\s+CEDEX\b.*$/i,
        /\s+v\s+Aav.*$/i,
        /\s+Contad\s+Tel.*$/i,
        /\s+Tel\s+Ret.*$/i,
        /\s+CONTACT.*$/i,
        /\s+[A-Z]{2,}\s*$/,  // Trailing 2+ uppercase letters (country codes)
        /\s+\d+\s*$/,        // Trailing numbers
    ];

    for (const pattern of trailingGarbage) {
        city = city.replace(pattern, '');
    }

    // Remove special characters but keep hyphens and apostrophes
    city = city.replace(/[^A-Za-zÀ-ÿ\-\s']/g, '').trim();

    // Normalize multiple spaces and hyphens
    city = city.replace(/\s+/g, ' ').replace(/-+/g, '-').trim();

    // Remove leading/trailing hyphens
    city = city.replace(/^-+|-+$/g, '').trim();

    return city.length >= 2 ? city : null;
}

/**
 * Calculate similarity between two strings (Levenshtein-based)
 */
export function stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    if (longer.length === 0) return 1;

    // Simple character overlap for performance
    const longerLower = longer.toLowerCase();
    const shorterLower = shorter.toLowerCase();

    let matches = 0;
    for (const char of shorterLower) {
        if (longerLower.includes(char)) matches++;
    }

    return matches / longer.length;
}

// ============================================================================
// EXTRACTION FUNCTIONS (Robust regex-based)
// ============================================================================

/**
 * 1. EXTRACT POSTAL CODE + CITY
 * Most reliable anchor for French addresses
 * Format: "69230 Saint-Genis-Laval" or "75001 Paris"
 */
function extractPostalCodeAndCity(lines: string[]): {
    postalCode: string | null;
    city: string | null;
    lineIndex: number;
} {
    // Multiple regex patterns for flexibility (OCR can have errors)
    // Use word boundaries (\b) to avoid matching postal codes inside phone numbers
    const patterns = [
        // Standard: "69230 Saint-Genis-Laval"
        /\b(\d{5})\s+([A-ZÀ-ÿa-z][A-ZÀ-ÿa-z\-\s']+)/,
        // With separator: "69230 - Saint-Genis-Laval"
        /\b(\d{5})\s*[-–—]\s*([A-ZÀ-ÿa-z][A-ZÀ-ÿa-z\-\s']+)/,
        // Just postal code at start of line
        /^(\d{5})\s+(.+)$/,
        // Postal code anywhere in line (with word boundary)
        /\b(\d{5})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s']{2,})/,
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const regex of patterns) {
            const match = line.match(regex);
            if (match) {
                const postalCode = match[1];
                // Validate postal code (French departments 01-95, 97x for overseas)
                const dept = parseInt(postalCode.substring(0, 2));
                if ((dept >= 1 && dept <= 95) || (dept >= 971 && dept <= 976)) {
                    // Clean city name
                    let city = cleanCityName(match[2]);

                    if (city && city.length >= 2) {
                        log(`[POSTAL] Found: ${postalCode} ${city} (pattern ${patterns.indexOf(regex)})`);
                        return {
                            postalCode: postalCode,
                            city: city,
                            lineIndex: i,
                        };
                    }
                }
            }
        }
    }

    // Fallback: just find any 5-digit number that looks like a postal code
    // Use word boundary to avoid matching inside phone numbers
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/\b(\d{5})\b/);
        if (match) {
            const postalCode = match[1];
            const dept = parseInt(postalCode.substring(0, 2));
            if ((dept >= 1 && dept <= 95) || (dept >= 971 && dept <= 976)) {
                // Try to extract city from rest of line
                const afterPostal = lines[i].substring(lines[i].indexOf(postalCode) + 5).trim();
                const cityMatch = afterPostal.match(/^[\s\-–—]*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s']+)/);
                let city = cityMatch ? cityMatch[1].trim() : null;

                // If no city on same line, check adjacent lines (before/after)
                if (!city) {
                    // Check line before postal code
                    if (i > 0) {
                        const prevLine = lines[i - 1].trim();
                        // City pattern: single word or hyphenated, starts with capital, 2-25 chars
                        if (/^[A-ZÀ-Ÿ][a-zà-ÿ]+(?:-[A-ZÀ-Ÿ]?[a-zà-ÿ]+)*$/.test(prevLine) &&
                            prevLine.length >= 2 && prevLine.length <= 25) {
                            city = prevLine;
                            log(`[POSTAL] City found on previous line: ${city}`);
                        }
                    }
                    // Check line after postal code
                    if (!city && i < lines.length - 1) {
                        const nextLine = lines[i + 1].trim();
                        if (/^[A-ZÀ-Ÿ][a-zà-ÿ]+(?:-[A-ZÀ-Ÿ]?[a-zà-ÿ]+)*$/.test(nextLine) &&
                            nextLine.length >= 2 && nextLine.length <= 25) {
                            city = nextLine;
                            log(`[POSTAL] City found on next line: ${city}`);
                        }
                    }
                }

                log(`[POSTAL] Fallback found: ${postalCode} ${city}`);
                return {
                    postalCode: postalCode,
                    city: city,
                    lineIndex: i,
                };
            }
        }
    }

    return { postalCode: null, city: null, lineIndex: -1 };
}

/**
 * 2. EXTRACT STREET
 * Look for lines with street number + street type keyword
 * Also handles case where street is on same line as postal code (e.g., "Chemin des Vignes 06000 Nice")
 */
function extractStreet(lines: string[], postalLineIndex: number): {
    street: string | null;
    lineIndex: number;
} {
    // Street type keywords (French) - including common OCR errors
    // ATE = ROUTE (OCR error), RTE = ROUTE abbreviation
    const streetTypes = 'rue|avenue|av|boulevard|bd|bld|place|allée|allee|chemin|impasse|route|rte|ate|passage|square|cours|quai|voie|résidence|residence|lotissement|hameau|lieu-dit|lieudit';
    const streetTypesRegex = new RegExp(`(?:${streetTypes})`, 'i');

    // Pattern 1: Number + street type (e.g., "20 Avenue Maréchal Foch")
    const streetRegex1 = new RegExp(`^\\d{1,4}[\\s,]*(?:bis|ter)?\\s*(?:${streetTypes})`, 'i');

    // Pattern 2: Street type at start (e.g., "Rue de la Paix")
    const streetRegex2 = new RegExp(`^(?:${streetTypes})\\s+`, 'i');

    // Pattern 3: Number + any text with street keyword anywhere
    const streetRegex3 = new RegExp(`\\d{1,4}[\\s,]+.*(?:${streetTypes})`, 'i');

    // Pattern 4: Street keyword anywhere in line
    const streetRegex4 = new RegExp(`(?:${streetTypes})\\s+[A-Za-zÀ-ÿ]`, 'i');

    // FIRST: Check if street is on the SAME LINE as postal code
    // e.g., "Chemin des Vignes 06000 Nice" → extract "Chemin des Vignes"
    if (postalLineIndex >= 0) {
        const postalLine = lines[postalLineIndex];
        const postalMatch = postalLine.match(/\d{5}/);
        if (postalMatch && postalMatch.index !== undefined && postalMatch.index > 0) {
            const beforePostal = postalLine.substring(0, postalMatch.index).trim();
            if (beforePostal.length >= 5 && streetTypesRegex.test(beforePostal)) {
                log(`[STREET] Same-line extraction: ${beforePostal}`);
                return { street: beforePostal, lineIndex: postalLineIndex };
            }
        }
    }

    // First pass: strict patterns (skip postal line)
    for (let i = 0; i < lines.length; i++) {
        if (i === postalLineIndex) continue;
        const line = lines[i];

        if (streetRegex1.test(line)) {
            log(`[STREET] Pattern 1 matched: ${line}`);
            return { street: line.trim(), lineIndex: i };
        }
        if (streetRegex2.test(line)) {
            log(`[STREET] Pattern 2 matched: ${line}`);
            return { street: line.trim(), lineIndex: i };
        }
    }

    // Second pass: looser patterns
    for (let i = 0; i < lines.length; i++) {
        if (i === postalLineIndex) continue;
        const line = lines[i];

        if (streetRegex3.test(line)) {
            log(`[STREET] Pattern 3 matched: ${line}`);
            return { street: line.trim(), lineIndex: i };
        }
        if (streetRegex4.test(line) && line.length > 8) {
            log(`[STREET] Pattern 4 matched: ${line}`);
            return { street: line.trim(), lineIndex: i };
        }
    }

    // Fallback: look for line with number at start near postal code line
    if (postalLineIndex > 0) {
        for (let i = Math.max(0, postalLineIndex - 3); i < postalLineIndex; i++) {
            const line = lines[i];
            // Line starts with number and has reasonable length
            if (/^\d{1,4}[\s,]+[A-ZÀ-ÿa-z]/.test(line) && line.length > 8) {
                log(`[STREET] Fallback matched: ${line}`);
                return { street: line.trim(), lineIndex: i };
            }
        }
    }

    // Last resort: any line with a number followed by text
    for (let i = 0; i < lines.length; i++) {
        if (i === postalLineIndex) continue;
        const line = lines[i];
        if (/^\d{1,4}\s+[A-Za-zÀ-ÿ]/.test(line) && line.length > 10 && line.length < 60) {
            log(`[STREET] Last resort matched: ${line}`);
            return { street: line.trim(), lineIndex: i };
        }
    }

    // INLINE EXTRACTION: Find street pattern WITHIN long lines (OCR often concatenates)
    // Pattern: "13 RUE BLAISE PASCAL" or "159 ROUTE DE BRIGNAIS" embedded in text
    const inlineStreetRegex = new RegExp(
        `(\\d{1,4})\\s+(${streetTypes})\\s+(?:DE\\s+(?:LA\\s+)?|DU\\s+|DES\\s+|D')?([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\\s\\-']{2,25})`,
        'gi'
    );

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = [...line.matchAll(inlineStreetRegex)];
        if (matches.length > 0) {
            // Take the best match (prefer one before postal code)
            for (const match of matches) {
                const streetNum = match[1];
                let streetType = match[2].toUpperCase();
                // Fix OCR errors
                if (streetType === 'ATE') streetType = 'ROUTE';
                if (streetType === 'RTE') streetType = 'ROUTE';

                let streetName = match[3].trim();
                // Clean up street name - stop at postal code or garbage
                streetName = streetName.replace(/\s+F\s*-?\s*$/, '').trim();
                streetName = streetName.replace(/\s+\d{5}.*$/, '').trim();
                streetName = streetName.replace(/\s+[A-Z]{2,3}\s*$/, '').trim();

                if (streetName.length >= 2) {
                    const preposition = match[0].match(/\s+(DE\s+(?:LA\s+)?|DU\s+|DES\s+|D')/i)?.[1] || '';
                    const fullStreet = `${streetNum} ${streetType} ${preposition}${streetName}`.replace(/\s+/g, ' ').trim();
                    log(`[STREET] Inline extraction: ${fullStreet}`);
                    return { street: fullStreet, lineIndex: i };
                }
            }
        }
    }

    // LAST RESORT: Find just a street number before postal code (e.g., "134 69660")
    // This handles labels where address is just a number
    if (postalLineIndex >= 0) {
        const postalLine = lines[postalLineIndex];
        // Look for pattern: "NAME NAME 134 69660" - extract "134" as street number
        const numberBeforePostalPattern = /\b(\d{1,4})\s+\d{5}\b/;
        const match = postalLine.match(numberBeforePostalPattern);
        if (match) {
            log(`[STREET] Number before postal found: ${match[1]}`);
            return { street: match[1], lineIndex: postalLineIndex };
        }
    }

    return { street: null, lineIndex: -1 };
}

/**
 * 3. EXTRACT PHONE NUMBER
 * 
 * Supports French formats:
 * - +33 6 12 34 56 78
 * - 06 12 34 56 78
 * - 06.12.34.56.78
 * 
 * Detection rules:
 * - With keyword: always detected
 * - Mobile (06/07) at end of line: detected without keyword
 * - Other cases: require keyword or short line
 */
function extractPhone(lines: string[]): string | null {
    // PRIORITY 1: Look for "TEL:" or "CONTACT:" followed by number (most reliable on labels)
    const telKeywordPattern = /(?:TEL|TELEPHONE|CONTACT)\s*[:\s]\s*(\+?33|0)?(\d[\d\s.\-\/]{8,14})/i;

    for (const line of lines) {
        const match = line.match(telKeywordPattern);
        if (match) {
            let phone = (match[1] || '') + match[2];
            phone = phone.replace(/[\s.\-\/]/g, '');
            // Normalize to +33 format
            if (phone.startsWith('33') && !phone.startsWith('+')) {
                phone = '+' + phone;
            } else if (phone.startsWith('0') && phone.length === 10) {
                phone = '+33' + phone.slice(1);
            } else if (!phone.startsWith('+') && phone.length === 9) {
                phone = '+33' + phone;
            }
            // Validate: French phone should be +33 + 9 digits
            if (phone.match(/^\+33[1-9]\d{8}$/)) {
                log(`[PHONE] TEL keyword detected: ${phone}`);
                return phone;
            }
        }
    }

    // PRIORITY 2: International format (0033/+33) - more permissive for OCR errors
    // Pattern allows optional 0 after 0033 (common OCR concatenation issue)
    const internationalPatterns = [
        /(\+33|0033)\s*0?\s*[1-9](?:[\s.\-\/]?\d{2}){4}/,  // Standard with optional leading 0
        /(\+33|0033)\s*\d{9,10}/,  // Compact format (all digits together)
    ];
    for (const pattern of internationalPatterns) {
        for (const line of lines) {
            const match = line.match(pattern);
            if (match) {
                let phone = match[0].replace(/[\s.\-\/]/g, '');
                // Remove 0033 prefix and normalize
                if (phone.startsWith('0033')) {
                    phone = phone.slice(4);
                } else if (phone.startsWith('+33')) {
                    phone = phone.slice(3);
                }
                // Remove leading 0 if present (0033 0 6 12...)
                if (phone.startsWith('0') && phone.length > 9) {
                    phone = phone.slice(1);
                }
                // Validate length and format
                if (phone.length === 9 && /^[1-9]\d{8}$/.test(phone)) {
                    phone = '+33' + phone;
                    log(`[PHONE] International detected: ${phone}`);
                    return phone;
                }
            }
        }
    }

    // PRIORITY 3: National format with context (keyword or short line)
    const phoneKeywords = ['téléphone', 'telephone', 'tél', 'portable', 'mobile', 'numéro', 'numero'];
    const nationalPattern = /0\s*[1-9](?:[\s.\-\/]?\d{2}){4}/;
    const phoneAtEndPattern = /0\s*[1-9](?:[\s.\-\/]?\d{2}){4}\s*$/;

    for (const line of lines) {
        const lower = line.toLowerCase();
        const hasKeyword = phoneKeywords.some(kw => lower.includes(kw));
        const hasPhoneAtEnd = phoneAtEndPattern.test(line);
        const isShortLine = line.length < 40;

        if (!hasKeyword && !isShortLine && !hasPhoneAtEnd) continue;

        const match = line.match(nationalPattern);
        if (match) {
            let phone = match[0].replace(/[\s.\-\/]/g, '');
            if (phone.startsWith('0') && phone.length === 10) {
                phone = '+33' + phone.slice(1);
            }
            log(`[PHONE] National detected: ${phone}`);
            return phone;
        }
    }
    return null;
}

/**
 * 4. EXTRACT NAME
 * 
 * Strategy:
 * - Look for lines without digits and without address/phone keywords
 * - Prefer lines with 2-3 words, all alphabetic
 * - Use known first names to distinguish first/last
 */
function extractName(
    lines: string[],
    usedLineIndices: Set<number>
): { firstName: string | null; lastName: string | null } {
    let bestCandidate: { firstName: string | null; lastName: string | null } = {
        firstName: null,
        lastName: null,
    };
    let bestScore = 0;

    for (let i = 0; i < lines.length; i++) {
        // Skip already used lines (street, postal, phone)
        if (usedLineIndices.has(i)) continue;

        let line = lines[i];
        let lower = line.toLowerCase();

        // If line contains annex keyword, extract only the part BEFORE the annex
        // e.g., "Nicolas Lefebvre Immeuble Le Quartz" → "Nicolas Lefebvre"
        for (const annexKw of ANNEX_KEYWORDS) {
            const annexIdx = lower.indexOf(annexKw);
            if (annexIdx > 0) {
                line = line.substring(0, annexIdx).trim();
                lower = line.toLowerCase();
                break;
            }
        }

        // EXCLUSIONS
        // Contains digits (except for apartment numbers like "Apt 3")
        if (/\d{2,}/.test(line)) continue;

        // Contains exclusion words
        if (NAME_EXCLUSION_WORDS.some(w => lower.includes(w))) continue;

        // Too long or too short
        if (line.length > 40 || line.length < 3) continue;

        // Split into words
        const words = line.split(/\s+/).filter(w =>
            w.length > 1 && /^[A-ZÀ-ÿa-z\-']+$/.test(w)
        );

        // Name typically has 1-4 words
        if (words.length < 1 || words.length > 4) continue;

        // Score this candidate
        let score = words.length >= 2 ? 2 : 1;

        // Check for known first names
        let detectedFirstName: string | null = null;
        let detectedLastName: string | null = null;
        let firstNameIndex = -1;

        for (let j = 0; j < words.length; j++) {
            const word = words[j];
            const wordLower = word.toLowerCase();

            if (COMMON_FIRST_NAMES.has(wordLower)) {
                detectedFirstName = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                firstNameIndex = j;
                score += 3;
                break; // Premier prénom trouvé, le reste = nom
            }
        }

        // Si prénom détecté, le reste des mots = nom de famille
        if (detectedFirstName && words.length > 1) {
            const lastNameWords = words.filter((_, idx) => idx !== firstNameIndex);
            if (lastNameWords.length > 0) {
                detectedLastName = lastNameWords
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                    .join(' ');
                score += 2;
            }
        }

        // Check for uppercase words (typical for last names on labels)
        if (!detectedLastName) {
            for (const word of words) {
                if (word === word.toUpperCase() && word.length > 2) {
                    detectedLastName = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                    score += 2;
                    break;
                }
            }
        }

        // Fallback: first word = first name, rest = last name
        if (!detectedFirstName && !detectedLastName && words.length >= 2) {
            detectedFirstName = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
            detectedLastName = words.slice(1)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');
            score += 1;
        } else if (!detectedFirstName && !detectedLastName && words.length === 1) {
            // Single word - could be last name
            detectedLastName = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
        }

        if (score > bestScore && (detectedFirstName || detectedLastName)) {
            bestScore = score;
            bestCandidate = {
                firstName: detectedFirstName,
                lastName: detectedLastName,
            };
        }
    }

    // INLINE EXTRACTION: Find name pattern WITHIN long lines (OCR often concatenates)
    // Look for patterns like "FABIENNE LANSARD" or "MALEK AIDOUDI"
    if (!bestCandidate.firstName && !bestCandidate.lastName) {
        // Common non-name words to exclude
        const excludeWords = new Set([
            'UPS', 'DHL', 'DPD', 'FRA', 'EUR', 'COD', 'EDI', 'STANDARD', 'TRACKING', 'BILLING',
            'CHEQUE', 'PAIEMENT', 'REFERENCE', 'SHIP', 'MONT', 'FRANCE', 'LYON', 'PARIS',
            'RUE', 'AVENUE', 'ROUTE', 'BOULEVARD', 'PLACE', 'CEDEX', 'CONTACT', 'NET',
            'CAPITAL', 'WEIGHT', 'DATE', 'SAVER', 'RACKING', 'PREDICT', 'PREP', 'COLIS',
            'TRA', 'RET', 'INTO', 'POIDS', 'TOUS', 'MOYENS', 'ACCEPTES', 'NANTE', 'CONTAD',
            'WHATSAPP', 'ZOOM', 'HIGHLIGHT', 'VIEW', 'IMAGE', 'TERRENE', 'TERTENT'
        ]);

        // Pattern 1: Look for known first name followed by another word (most reliable)
        const knownNamePattern = /\b([A-Z][A-Za-z]+)\s+([A-Z][A-Za-z]+)\b/g;

        for (const line of lines) {
            const matches = [...line.matchAll(knownNamePattern)];
            for (const match of matches) {
                const word1 = match[1];
                const word2 = match[2];
                const word1Lower = word1.toLowerCase();

                // Skip if either word is excluded
                if (excludeWords.has(word1.toUpperCase()) || excludeWords.has(word2.toUpperCase())) continue;

                // Check if first word is a known first name
                if (COMMON_FIRST_NAMES.has(word1Lower)) {
                    bestCandidate = {
                        firstName: word1.charAt(0).toUpperCase() + word1.slice(1).toLowerCase(),
                        lastName: word2.charAt(0).toUpperCase() + word2.slice(1).toLowerCase(),
                    };
                    log(`[NAME] Inline known name extraction: ${bestCandidate.firstName} ${bestCandidate.lastName}`);
                    break;
                }
            }
            if (bestCandidate.firstName) break;
        }

        // Pattern 2: Look for 2 uppercase words before a number (common on labels: "FABIENNE LANSARD 134")
        if (!bestCandidate.firstName) {
            const nameBeforeNumberPattern = /\b([A-Z]{2,}[A-Za-z]*)\s+([A-Z]{2,}[A-Za-z]*)\s+\d{1,4}\b/g;
            for (const line of lines) {
                const matches = [...line.matchAll(nameBeforeNumberPattern)];
                for (const match of matches) {
                    const word1 = match[1];
                    const word2 = match[2];

                    // Skip if either word is excluded or too short
                    if (excludeWords.has(word1.toUpperCase()) || excludeWords.has(word2.toUpperCase())) continue;
                    if (word1.length < 3 || word2.length < 3) continue;

                    bestCandidate = {
                        firstName: word1.charAt(0).toUpperCase() + word1.slice(1).toLowerCase(),
                        lastName: word2.charAt(0).toUpperCase() + word2.slice(1).toLowerCase(),
                    };
                    log(`[NAME] Name before number extraction: ${bestCandidate.firstName} ${bestCandidate.lastName}`);
                    break;
                }
                if (bestCandidate.firstName) break;
            }
        }
    }

    return bestCandidate;
}

/**
 * 5. EXTRACT ADDRESS ANNEX
 * 
 * Look for building, apartment, villa, lotissement info
 * E.g., "Bât A", "Villa 12", "Résidence Les Oliviers", "Apt 3B"
 * 
 * Also extracts from the street/address line itself (e.g., "43 Chem. de la Citadelle villa 35")
 */
function extractAddressAnnex(lines: string[], usedLineIndices: Set<number>, street: string | null): string | null {
    const annexParts: string[] = [];

    // Pattern pour capturer: "villa 35", "bât A", "apt 12B", "bureau 201", etc.
    // Généré dynamiquement depuis ANNEX_KEYWORDS
    const annexKeywordsPattern = ANNEX_KEYWORDS.join('|');
    const annexPattern = new RegExp(`\\b(${annexKeywordsPattern})\\s*[:\\-]?\\s*([A-Za-z0-9À-ÿ\\-]+)`, 'gi');

    // 1. D'abord chercher dans la rue elle-même (le plus important)
    if (street) {
        const matches = street.matchAll(annexPattern);
        for (const match of matches) {
            annexParts.push(match[0].trim());
        }
    }

    // 2. Ensuite chercher dans les lignes non-utilisées
    for (let i = 0; i < lines.length; i++) {
        if (usedLineIndices.has(i)) continue;

        const line = lines[i];
        const lower = line.toLowerCase();

        // Check if line contains annex keywords
        for (const keyword of ANNEX_KEYWORDS) {
            if (lower.includes(keyword)) {
                const matches = line.matchAll(annexPattern);
                for (const match of matches) {
                    annexParts.push(match[0].trim());
                }
                // Also check for standalone annex lines like "Digicode: 1234"
                if (annexParts.length === 0 && line.length < 50) {
                    annexParts.push(line.trim());
                }
                break;
            }
        }
    }

    if (annexParts.length === 0) return null;

    // Dedupe and join
    const uniqueParts = [...new Set(annexParts)];
    const result = uniqueParts.join(', ');

    log(`[PARSE] AddressAnnex: ${result}`);
    return result;
}

/**
 * 6. EXTRACT COMPANY NAME
 * 
 * Detect business/company names (personnes morales)
 * E.g., "Restaurant Le Petit Zinc", "SARL Dupont", "Pharmacie du Centre"
 * Handles cases where company name is on same line as postal code
 */
function extractCompanyName(
    lines: string[],
    usedLineIndices: Set<number>
): { companyName: string | null; isCompany: boolean; lineIndex: number } {
    // Postal code pattern to extract company name before it
    const postalPattern = /^(.+?)\s+(\d{5})\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\-\s]+)$/;

    for (let i = 0; i < lines.length; i++) {
        if (usedLineIndices.has(i)) continue;

        const line = lines[i];
        const lower = line.toLowerCase();

        // Skip very short lines
        if (line.length < 3) continue;

        // Check for company keywords FIRST (before skipping lines with digits)
        // Use word boundaries to avoid false positives like "ei" matching in garbage text
        for (const keyword of COMPANY_KEYWORDS) {
            // Build regex with word boundary - escape special chars
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const keywordRegex = new RegExp(`\\b${escaped}\\b`, 'i');
            if (keywordRegex.test(lower)) {
                // Found a company indicator
                let companyName = line.trim();

                // If line contains postal code, extract company name before it
                // E.g., "Restaurant Le Petit Zinc 75002 Paris" → "Restaurant Le Petit Zinc"
                const postalMatch = line.match(postalPattern);
                if (postalMatch) {
                    companyName = postalMatch[1].trim();
                }

                // Also remove phone numbers from beginning
                // E.g., "0380112233 CABINET MÉDICAL" → "CABINET MÉDICAL"
                companyName = companyName.replace(/^[\d\s]+/, '').trim();

                // Also remove street numbers/addresses at the end
                // E.g., "CABINET MÉDICAL DR MARTIN 8 RUE DE LA PAIX" → "CABINET MÉDICAL DR MARTIN"
                const streetMatch = companyName.match(/^(.+?)\s+\d+\s+(rue|avenue|boulevard|allée|chemin|place|impasse|passage)\b/i);
                if (streetMatch) {
                    companyName = streetMatch[1].trim();
                }

                if (companyName.length >= 3) {
                    log(`[PARSE] Company detected (keyword: ${keyword}): ${companyName}`);
                    return {
                        companyName,
                        isCompany: true,
                        lineIndex: i,
                    };
                }
            }
        }
    }

    return { companyName: null, isCompany: false, lineIndex: -1 };
}

// ============================================================================
// MAIN PARSING FUNCTION
// ============================================================================

/**
 * Parse OCR text and extract structured data
 * 
 * Order: PostalCode+City → Street → Phone → Company/Name
 * Then combine into full address
 */
export function parseOCRText(rawText: string): ParsedOCRData {
    // Pre-process: normalize voice input that uses slashes as separators
    // "06/12/34 67 44" → "06 12 34 67 44"
    let normalizedText = rawText;

    // Replace date-like phone patterns: 06/12/34 → 06 12 34
    normalizedText = normalizedText.replace(/(\d{2})\/(\d{2})\/(\d{2})(?!\d)/g, '$1 $2 $3');

    // Split on comma to help separate name/phone from address
    // "Jean Dupont 06 12 34 67 44, 20 Avenue..." → multi-line
    if (normalizedText.includes(',') && !normalizedText.includes('\n')) {
        normalizedText = normalizedText.replace(/,\s*/g, '\n');
    }

    const lines = splitLines(normalizedText);
    const usedLineIndices = new Set<number>();

    // DEBUG: Log raw text
    log('--- TEXTE BRUT (original) ---');
    log(rawText);
    log('--- TEXTE NORMALISÉ ---');
    log(normalizedText);
    log('--- LIGNES PARSÉES ---');
    lines.forEach((l, i) => log(`[${i}] ${l}`));
    log('------------------------');

    // 1. Extract phone FIRST (to avoid confusion with address numbers)
    const phoneNumber = extractPhone(lines);
    let phoneLineIndex = -1;
    if (phoneNumber) {
        // Find and mark phone line as used
        const phoneDigits = phoneNumber.replace(/\D/g, '').slice(-9); // Last 9 digits
        for (let i = 0; i < lines.length; i++) {
            const lineDigits = lines[i].replace(/\D/g, '');
            if (lineDigits.includes(phoneDigits)) {
                phoneLineIndex = i;
                usedLineIndices.add(i);
                break;
            }
        }
    }
    log(`[PARSE] Phone: ${phoneNumber} (line ${phoneLineIndex})`);

    // 2. Extract postal code + city (most reliable anchor)
    const { postalCode, city: cityFromPostal, lineIndex: postalLineIndex } = extractPostalCodeAndCity(lines);
    if (postalLineIndex >= 0) usedLineIndices.add(postalLineIndex);

    log(`[PARSE] PostalCode: ${postalCode}, City: ${cityFromPostal}`);

    // 3. Extract street
    const { street, lineIndex: streetLineIndex } = extractStreet(lines, postalLineIndex);
    if (streetLineIndex >= 0) usedLineIndices.add(streetLineIndex);

    log(`[PARSE] Street: ${street}`);

    // 4. If no postal code found, try to extract city from remaining lines
    let city = cityFromPostal;
    if (!city) {
        // Look for lines that look like city names (no numbers, proper format)
        for (let i = 0; i < lines.length; i++) {
            if (usedLineIndices.has(i)) continue;
            const line = lines[i].trim();

            // Skip lines that look like personal names (two capitalized words = "Firstname Lastname")
            // Cities are usually single words or hyphenated (Lyon, Saint-Étienne, Aix-en-Provence)
            const looksLikeName = /^[A-ZÀ-Ÿ][a-zà-ÿ]+\s+[A-ZÀ-Ÿ][a-zà-ÿ]+$/.test(line);
            if (looksLikeName) continue;

            // City pattern: single word or hyphenated words, starts with capital, 2-25 chars
            // NOT "Word Word" pattern (that's a name)
            if (/^[A-ZÀ-Ÿ][a-zà-ÿ]+(?:-[A-ZÀ-Ÿ]?[a-zà-ÿ]+)*$/.test(line) &&
                line.length >= 2 && line.length <= 25 &&
                !/\d/.test(line)) {
                // Exclude common non-city words and phone keywords
                const lower = line.toLowerCase();
                const excludedWords = [
                    'notes', 'remarques', 'bonjour', 'merci', 'today', 'days',
                    'téléphone', 'telephone', 'tél', 'tel', 'phone', 'portable', 'mobile',
                    'numéro', 'numero', 'zéro', 'zero', 'liquid', 'cycle'
                ];
                if (!excludedWords.some(w => lower.includes(w))) {
                    city = line;
                    usedLineIndices.add(i);
                    log(`[PARSE] City extracted without postal: ${city}`);
                    break;
                }
            }
        }
    }

    // 4. Extract company name first (before individual name)
    const { companyName, isCompany, lineIndex: companyLineIndex } = extractCompanyName(lines, usedLineIndices);
    if (companyLineIndex >= 0) usedLineIndices.add(companyLineIndex);

    log(`[PARSE] Company: ${companyName} (isCompany: ${isCompany})`);

    // 5. Extract individual name from remaining lines (only if not a company)
    let firstName: string | null = null;
    let lastName: string | null = null;
    if (!isCompany) {
        const nameResult = extractName(lines, usedLineIndices);
        firstName = nameResult.firstName;
        lastName = nameResult.lastName;
    }

    log(`[PARSE] Name: ${firstName} ${lastName}`);

    // 6. Extract address annex (bâtiment, villa, lotissement, etc.)
    const addressAnnex = extractAddressAnnex(lines, usedLineIndices, street);

    // 7. Build full address (clean street from annex parts, phone, and names)
    let address: string | null = null;
    const addressParts: string[] = [];

    // Look for street number on separate line (e.g., "20" alone after comma split)
    let streetNumber: string | null = null;
    for (let i = 0; i < lines.length; i++) {
        if (usedLineIndices.has(i)) continue;
        const line = lines[i].trim();
        // Pure number, 1-4 digits, likely street number
        if (/^\d{1,4}$/.test(line)) {
            streetNumber = line;
            usedLineIndices.add(i);
            log(`[PARSE] Street number found: ${streetNumber}`);
            break;
        }
    }

    // Clean street by removing annex parts
    let cleanStreet = street;
    if (cleanStreet && addressAnnex) {
        const annexKeywordsPattern = ANNEX_KEYWORDS.join('|');
        const annexCleanRegex = new RegExp(`\\s*(${annexKeywordsPattern})\\s*[:\\-]?\\s*[A-Za-z0-9À-ÿ\\-]*`, 'gi');
        cleanStreet = cleanStreet.replace(annexCleanRegex, '').replace(/\s{2,}/g, ' ').trim();
        // Remove trailing punctuation
        cleanStreet = cleanStreet.replace(/[\-\s]+$/, '').trim();
    }

    // Remove phone number from street (voice input may include it)
    // Also extract name BEFORE phone keyword: "Jean Dupont téléphone 06..." → extract "Jean Dupont"
    if (cleanStreet) {
        const phoneKeywordsPattern = '(?:téléphone|telephone|tél|tel|phone|portable|mobile|numéro|numero)';

        // Try to extract name before phone keyword
        const nameBeforePhoneMatch = cleanStreet.match(new RegExp(`([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\\s+[A-ZÀ-Ÿa-zà-ÿ]+)?)\\s+${phoneKeywordsPattern}`, 'i'));
        if (nameBeforePhoneMatch && !firstName && !lastName) {
            const potentialName = nameBeforePhoneMatch[1].trim();
            const nameParts = potentialName.split(/\s+/);
            if (nameParts.length >= 2) {
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join(' ');
                log(`[PARSE] Name extracted before phone: ${firstName} ${lastName}`);
            }
        }

        // Remove everything from phone keyword onwards
        const phoneCleanRegex = new RegExp(`\\s*[A-ZÀ-Ÿa-zà-ÿ\\s]*${phoneKeywordsPattern}[:\\s]*[\\d\\s.\\-\\/zéro]+`, 'gi');
        cleanStreet = cleanStreet.replace(phoneCleanRegex, '').replace(/\s{2,}/g, ' ').trim();

        // Also remove voice number words
        cleanStreet = cleanStreet.replace(/\b(zéro|zero|un|deux|trois|quatre|cinq|six|sept|huit|neuf)\b/gi, '').trim();
        cleanStreet = cleanStreet.replace(/\s{2,}/g, ' ').trim();
    }

    // Prepend street number if found separately
    if (streetNumber && cleanStreet && !cleanStreet.match(/^\d/)) {
        cleanStreet = `${streetNumber} ${cleanStreet}`;
    }

    if (cleanStreet) addressParts.push(cleanStreet);
    if (postalCode && city) {
        addressParts.push(`${postalCode} ${city}`);
    } else if (city) {
        addressParts.push(city);
    }

    if (addressParts.length > 0) {
        address = addressParts.join(', ');
    }

    log(`[PARSE] Full Address: ${address}`);

    // Calculate confidence based on what we found
    let confidence = 0;
    if (postalCode && city) confidence += 0.4;  // Postal + city = strong
    if (street) confidence += 0.3;              // Street = good
    if (phoneNumber) confidence += 0.15;
    if (firstName || lastName) confidence += 0.15;
    confidence = Math.min(confidence, 1);

    return {
        address,
        street,
        postalCode,
        city,
        addressAnnex,
        phoneNumber,
        firstName,
        lastName,
        companyName,
        isCompany,
        confidence,
        rawText: rawText,
    };
}

/**
 * Check if parsed data has a valid address
 * OCR-friendly: postal code + city is SUFFICIENT for geocoding
 * Street is a bonus, NOT mandatory
 */
export function hasValidAddress(data: ParsedOCRData): boolean {
    // Pour géocoder une adresse, on a besoin AU MINIMUM de:
    // - Code postal + Ville (suffisant pour Google Maps)
    // - OU une adresse complète construite

    const hasPostalCode = data.postalCode !== null && data.postalCode.length === 5;
    const hasCity = data.city !== null && data.city.length >= 2;
    const hasAddress = data.address !== null && data.address.length >= 8;

    // CP + Ville = adresse géocodable (même sans street)
    // Ex: "06000 Nice" → Google trouve
    // Ex: "Chemin des Vignes, 06000 Nice" → encore mieux
    return (hasPostalCode && hasCity) || hasAddress;
}

/**
 * Compare two ParsedOCRData for stabilization
 * Returns true if they are "similar enough" to be considered stable
 */
export function areResultsSimilar(a: ParsedOCRData, b: ParsedOCRData): boolean {
    // Both must have addresses
    if (!a.address || !b.address) return false;

    // Addresses must be very similar
    const addressSimilarity = stringSimilarity(a.address, b.address);
    if (addressSimilarity < 0.85) return false;

    // Phone numbers must match if both present
    if (a.phoneNumber && b.phoneNumber && a.phoneNumber !== b.phoneNumber) {
        return false;
    }

    return true;
}

/**
 * Hook for OCR parsing
 */
export function useOCRParsing() {
    return {
        parseOCRText,
        hasValidAddress,
        areResultsSimilar,
        stringSimilarity,
    };
}

export default useOCRParsing;
