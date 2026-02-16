// =============================================================================
// PRODUCTION-GRADE OCR PARSER FOR FRENCH SHIPPING LABELS
// Version: 2.0.0
// Architecture: Probabilistic Pipeline with Fuzzy Matching
// =============================================================================

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface ParsedAddress {
  firstName: string;
  lastName: string;
  companyName: string;
  street: string;
  addressAnnex: string;
  postalCode: string;
  city: string;
  phoneNumber: string;
  fullAddress: string;
  confidence: number;
  rawText?: string; // Original OCR text for debugging/logging
}

interface LineClassification {
  type: LineType;
  score: number;
  content: string;
  originalIndex: number;
}

interface Candidate<T> {
  value: T;
  score: number;
  source: 'line' | 'global' | 'inline';
}

interface ExtractionContext {
  normalizedText: string;
  normalizedLines: string[];
  originalLines: string[];
  fullText: string;
  fullTextNoBreaks: string;
  classifications: LineClassification[];
}

interface FieldCandidates {
  firstName: Candidate<string>[];
  lastName: Candidate<string>[];
  companyName: Candidate<string>[];
  street: Candidate<string>[];
  addressAnnex: Candidate<string>[];
  postalCode: Candidate<string>[];
  city: Candidate<string>[];
  phoneNumber: Candidate<string>[];
}

type LineType = 'phone' | 'postal' | 'street' | 'name' | 'annex' | 'company' | 'unknown';

// =============================================================================
// CONSTANTS & DICTIONARIES
// =============================================================================

const OCR_CORRECTIONS: Record<string, string> = {
  'rve': 'rue',
  'rvue': 'rue',
  'avenve': 'avenue',
  'avenvue': 'avenue',
  'avennue': 'avenue',
  'boulevart': 'boulevard',
  'boulevrad': 'boulevard',
  'boulvard': 'boulevard',
  'bouleward': 'boulevard',
  'imapsse': 'impasse',
  'lmpasse': 'impasse',
  'irnpasse': 'impasse',
  'chemln': 'chemin',
  'chermin': 'chemin',
  'chernin': 'chemin',
  'ate': 'rte',
  'rie': 'rue',
  'nue': 'rue',
  'de l': 'de l\'',
  'del': 'de l\'',
  'esperan': 'esperance',
  'brionais': 'brionnais',
  'allee': 'allée',
  'allle': 'allée',
  'plaee': 'place',
  'plase': 'place',
  'plce': 'place',
  'passaqe': 'passage',
  'passge': 'passage',
  'squrae': 'square',
  'sqaure': 'square',
  'residenee': 'residence',
  'residance': 'residence',
  'batirment': 'batiment',
  'batirnent': 'batiment',
  'batirrent': 'batiment',
  'escalller': 'escalier',
  'escallier': 'escalier',
  'etaqe': 'etage',
  'etaage': 'etage',
  'appartement': 'appartement',
  'apparternent': 'appartement',
  'appt': 'appartement',
  'apt': 'appartement',
  'cedax': 'cedex',
  'cedeix': 'cedex',
  'cedeex': 'cedex',
  'lyon': 'lyon',
  'lyan': 'lyon',
  'lyorn': 'lyon',
  'parls': 'paris',
  'parris': 'paris',
  'pariis': 'paris',
  'marseile': 'marseille',
  'marsielle': 'marseille',
  'marsellle': 'marseille',
  'tlphone': 'telephone',
  'telephonne': 'telephone',
  'telepohne': 'telephone',
  'portabel': 'portable',
  'portabble': 'portable',
  'moblle': 'mobile',
  'mobiel': 'mobile',
  'monsleur': 'monsieur',
  'monssieur': 'monsieur',
  'monseiur': 'monsieur',
  'rnadame': 'madame',
  'madarme': 'madame',
  'madarne': 'madame',
  'rnademoiselle': 'mademoiselle',
  'madernoisselle': 'mademoiselle',
};

const STREET_KEYWORDS: string[] = [
  'rue', 'avenue', 'boulevard', 'place', 'chemin', 'route', 'allée', 'allee',
  'impasse', 'passage', 'square', 'cours', 'quai', 'voie', 'sentier',
  'traverse', 'ruelle', 'esplanade', 'promenade', 'mail', 'parvis',
  'lotissement', 'hameau', 'lieu-dit', 'lieudit', 'zone', 'za', 'zi',
  'residence', 'résidence', 'domaine', 'parc', 'cité', 'cite',
  'av', 'bd', 'bld', 'blvd', 'pl', 'ch', 'rte', 'all', 'imp', 'pass', 'sq',
];

const ANNEX_KEYWORDS: string[] = [
  'batiment', 'bâtiment', 'bat', 'bât', 'building',
  'escalier', 'esc',
  'etage', 'étage', 'eme', 'ème', 'er',
  'appartement', 'appt', 'apt', 'app',
  'porte', 'pte',
  'entree', 'entrée', 'ent',
  'digicode', 'code', 'interphone',
  'boite', 'boîte', 'bp', 'bal',
  'villa', 'pavillon',
  'residence', 'résidence', 'res',
  'tour', 'bloc',
];

const COMPANY_INDICATORS: string[] = [
  'sarl', 'sas', 'sa', 'eurl', 'sasu', 'sci', 'snc',
  'entreprise', 'ets', 'etablissements', 'établissements',
  'societe', 'société', 'ste',
  'groupe', 'group', 'holding',
  'france', 'international', 'services', 'industrie',
  'transport', 'transports', 'logistique', 'logistics',
  'distribution', 'import', 'export',
];

const CIVILITY_PREFIXES: string[] = [
  'monsieur', 'madame', 'mademoiselle', 'mlle', 'mme', 'mr', 'm.',
  'dr', 'docteur', 'professeur', 'prof', 'maitre', 'maître', 'me',
];

const FRENCH_FIRST_NAMES: Set<string> = new Set([
  'jean', 'pierre', 'marie', 'michel', 'andre', 'philippe', 'alain', 'bernard',
  'jacques', 'daniel', 'christian', 'robert', 'patrick', 'roger', 'claude',
  'marcel', 'paul', 'louis', 'rene', 'henri', 'francois', 'gerard', 'nicolas',
  'laurent', 'stephane', 'christophe', 'david', 'eric', 'frederic', 'olivier',
  'thierry', 'pascal', 'serge', 'yves', 'bruno', 'didier', 'franck', 'jerome',
  'marc', 'vincent', 'sebastien', 'julien', 'guillaume', 'anthony', 'thomas',
  'alexandre', 'maxime', 'antoine', 'kevin', 'jeremy', 'romain', 'florian',
  'nathalie', 'isabelle', 'catherine', 'sylvie', 'monique', 'nicole', 'anne',
  'francoise', 'martine', 'christine', 'valerie', 'sandrine', 'stephanie',
  'veronique', 'sophie', 'aurelie', 'celine', 'emilie', 'julie', 'caroline',
  'laura', 'marine', 'pauline', 'camille', 'lea', 'manon', 'chloe', 'emma',
  'sarah', 'clara', 'ines', 'jade', 'louise', 'alice', 'lola', 'anna', 'eva',
  'lucas', 'hugo', 'enzo', 'nathan', 'louis', 'gabriel', 'leo', 'raphael',
  'arthur', 'adam', 'jules', 'paul', 'ethan', 'noah', 'tom', 'theo', 'liam',
  'mohamed', 'ahmed', 'ali', 'karim', 'rachid', 'said', 'youssef', 'abdel',
  'fatima', 'aicha', 'amina', 'samira', 'leila', 'nadia', 'souad', 'khadija',
  'malek', 'malik', 'amine', 'mehdi', 'younes', 'bilal', 'ilyes', 'rayan',
  'sofiane', 'nassim', 'walid', 'hamza', 'zakaria', 'yanis', 'sami', 'omar',
  'salim', 'nabil', 'hicham', 'mourad', 'tarek', 'farid', 'hakim', 'nordine',
  'sarah', 'yasmine', 'meryem', 'asma', 'zineb', 'imane', 'houda', 'rania',
]);

const MAJOR_FRENCH_CITIES: Set<string> = new Set([
  'paris', 'marseille', 'lyon', 'toulouse', 'nice', 'nantes', 'montpellier',
  'strasbourg', 'bordeaux', 'lille', 'rennes', 'reims', 'saint-etienne',
  'toulon', 'le havre', 'grenoble', 'dijon', 'angers', 'nimes', 'villeurbanne',
  'saint-denis', 'aix-en-provence', 'le mans', 'clermont-ferrand', 'brest',
  'tours', 'amiens', 'limoges', 'annecy', 'perpignan', 'besancon', 'metz',
  'orleans', 'rouen', 'mulhouse', 'caen', 'nancy', 'argenteuil', 'montreuil',
  'roubaix', 'tourcoing', 'dunkerque', 'avignon', 'poitiers', 'versailles',
  'colombes', 'aulnay-sous-bois', 'asnieres-sur-seine', 'vitry-sur-seine',
  'saint genis laval', 'saint-genis-laval', 'venissieux', 'vénissieux',
  'villefranche', 'oullins', 'tassin', 'ecully', 'caluire', 'bron', 'meyzieu',
  'decines', 'décines', 'chassieu', 'corbas', 'feyzin', 'irigny', 'pierre-benite',
  'saint-fons', 'saint fons', 'givors', 'grigny', 'mions', 'chaponnay',
]);

// Helper to normalize city names (handle "SAINT - GENIS - LAVAL" -> "saint-genis-laval")
function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .replace(/\s*-\s*/g, '-')     // "SAINT - GENIS" -> "saint-genis"
    .replace(/\s+/g, '-')          // "SAINT GENIS" -> "saint-genis"
    .replace(/-+/g, '-')           // Multiple hyphens -> single hyphen
    .trim();
}

// Helper to normalize street number position (move number from end to start)
// "AVENUE DU GÉNÉRAL DE GAULLE 29" -> "29 Avenue du Général de Gaulle"
function normalizeStreetNumberPosition(street: string): string {
  // Pattern: street name followed by number at end
  const endNumberPattern = /^(.+?)\s+(\d{1,4}\s*(?:bis|ter|quater)?)\s*$/i;
  const match = street.match(endNumberPattern);

  if (match) {
    const streetName = match[1].trim();
    const streetNumber = match[2].trim();
    // Check if streetName contains a street keyword (rue, avenue, etc.)
    const hasStreetKeyword = STREET_KEYWORDS.some(kw =>
      streetName.toLowerCase().includes(kw.toLowerCase())
    );
    if (hasStreetKeyword) {
      return `${streetNumber} ${streetName}`;
    }
  }
  return street;
}

// Helper to clean city name (remove trailing department code like "69")
function cleanCityName(city: string): string {
  // Remove trailing 2-digit department code: "ST GENIS LAVAL 69" -> "ST GENIS LAVAL"
  return city
    .replace(/\s+\d{2}\s*$/, '')
    .trim();
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

function fuzzyMatch(text: string, keywords: string[], threshold: number = 0.75): { keyword: string; score: number; position: number } | null {
  const words = text.split(/\s+/);
  let bestMatch: { keyword: string; score: number; position: number } | null = null;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    for (const keyword of keywords) {
      const similarity = stringSimilarity(word, keyword);
      if (similarity >= threshold && (!bestMatch || similarity > bestMatch.score)) {
        bestMatch = { keyword, score: similarity, position: i };
      }
    }
  }

  return bestMatch;
}

function fuzzyContains(text: string, keywords: string[], threshold: number = 0.75): boolean {
  return fuzzyMatch(text, keywords, threshold) !== null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// NORMALIZATION FUNCTIONS
// =============================================================================

function normalizeUnicode(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[\t\r\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function applyOCRCorrections(text: string): string {
  let result = text.toLowerCase();

  for (const [wrong, correct] of Object.entries(OCR_CORRECTIONS)) {
    const regex = new RegExp(`\\b${escapeRegex(wrong)}\\b`, 'gi');
    result = result.replace(regex, correct);
  }

  return result;
}

function normalizeSlashNumbers(text: string): string {
  return text.replace(/(\d)\s*[/\\]\s*(\d)/g, '$1/$2');
}

function normalizePhoneSpacing(text: string): string {
  return text.replace(/(\d)\s*[.\-_]\s*(\d)/g, '$1$2');
}

function mergeBrokenTokens(text: string): string {
  return text
    .replace(/(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2})/g, '$1$2$3$4$5')
    .replace(/(\d{5})\s*-?\s*([A-Za-z])/g, '$1 $2')
    // Normalize city names with spaced hyphens: "SAINT - GENIS - LAVAL" -> "SAINT-GENIS-LAVAL"
    .replace(/([A-Za-z])\s+-\s+([A-Za-z])/g, '$1-$2');
}

function normalizeText(text: string): string {
  let result = text;

  result = normalizeUnicode(result);
  result = normalizeWhitespace(result);
  result = normalizeSlashNumbers(result);
  result = normalizePhoneSpacing(result);
  result = mergeBrokenTokens(result);
  result = applyOCRCorrections(result);

  return result;
}

// =============================================================================
// SHIP TO DETECTION - Extract recipient address only
// =============================================================================

const SHIP_TO_MARKERS = [
  'ship to', 'ship to:', 'shipto', 'shipto:',
  'deliver to', 'deliver to:', 'deliverto',
  'consignee', 'consignee:', 'destinataire', 'destinataire:',
  'livrer à', 'livrer a', 'livrer a:', 'livrer à:',
  'recipient', 'recipient:', 'dest:', 'dest',
  'à:', 'a:', // Common on French labels
];

const SHIP_FROM_MARKERS = [
  'ship from', 'ship from:', 'shipfrom',
  'sender', 'sender:', 'from:', 'from',
  'expediteur', 'expéditeur', 'expediteur:', 'expéditeur:',
  'shipper', 'shipper:', 'origin', 'origin:',
  'return to', 'return address', 'retour',
];

function extractRecipientSection(text: string): string {
  const lowerText = text.toLowerCase();

  // Find "Ship To" marker position
  let shipToIndex = -1;
  let shipToMarkerLength = 0;

  for (const marker of SHIP_TO_MARKERS) {
    const idx = lowerText.indexOf(marker);
    if (idx !== -1 && (shipToIndex === -1 || idx < shipToIndex)) {
      shipToIndex = idx;
      shipToMarkerLength = marker.length;
    }
  }

  // If we found "Ship To", extract text after it
  if (shipToIndex !== -1) {
    let recipientText = text.substring(shipToIndex + shipToMarkerLength);

    // Find if there's a "Ship From" or similar marker AFTER "Ship To" to cut off
    const lowerRecipient = recipientText.toLowerCase();
    let cutoffIndex = recipientText.length;

    for (const marker of SHIP_FROM_MARKERS) {
      const idx = lowerRecipient.indexOf(marker);
      if (idx !== -1 && idx > 20 && idx < cutoffIndex) { // At least 20 chars of content
        cutoffIndex = idx;
      }
    }

    if (cutoffIndex < recipientText.length) {
      recipientText = recipientText.substring(0, cutoffIndex);
    }

    return recipientText.trim();
  }

  // No "Ship To" found - check if there's "Ship From" to exclude
  let shipFromIndex = -1;
  let shipFromEndIndex = -1;

  for (const marker of SHIP_FROM_MARKERS) {
    const idx = lowerText.indexOf(marker);
    if (idx !== -1) {
      if (shipFromIndex === -1 || idx < shipFromIndex) {
        shipFromIndex = idx;
      }
    }
  }

  // If "Ship From" is at the beginning, try to find where recipient starts
  if (shipFromIndex !== -1 && shipFromIndex < 50) {
    // Look for a double newline or significant gap that might separate sections
    const afterFrom = text.substring(shipFromIndex);
    const sectionBreak = afterFrom.search(/\n\s*\n/);
    if (sectionBreak !== -1 && sectionBreak < 300) {
      return text.substring(shipFromIndex + sectionBreak).trim();
    }
  }

  // Return original text if no markers found
  return text;
}

// =============================================================================
// TOKENIZATION
// =============================================================================

function tokenize(text: string): { lines: string[]; fullText: string } {
  // First, try to extract only the recipient section
  const recipientText = extractRecipientSection(text);

  const normalized = normalizeText(recipientText);
  const lines = normalized
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const fullText = lines.join(' ').replace(/\s+/g, ' ');

  return { lines, fullText };
}

// =============================================================================
// LINE CLASSIFICATION
// =============================================================================

function scoreAsPhone(line: string): number {
  let score = 0;

  const digitsOnly = line.replace(/\D/g, '');

  if (digitsOnly.length === 10 && /^0[1-9]/.test(digitsOnly)) {
    score += 0.5;
  }

  if (/^0[67]/.test(digitsOnly)) {
    score += 0.3;
  }

  if (/tel|phone|portable|mobile|appel/i.test(line)) {
    score += 0.2;
  }

  const phonePattern = /(?:0|\+33|0033)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/;
  if (phonePattern.test(line)) {
    score += 0.3;
  }

  const nonDigitRatio = (line.length - digitsOnly.length) / Math.max(line.length, 1);
  if (digitsOnly.length >= 10 && nonDigitRatio < 0.3) {
    score += 0.2;
  }

  return Math.min(score, 1);
}

function scoreAsPostal(line: string): number {
  let score = 0;

  const postalPattern = /\b(\d{5})\b/;
  const match = line.match(postalPattern);

  if (match) {
    const code = match[1];
    score += 0.4;

    const dept = parseInt(code.substring(0, 2), 10);
    if ((dept >= 1 && dept <= 95) || dept === 97 || dept === 98) {
      score += 0.2;
    }

    if (/cedex/i.test(line)) {
      score += 0.1;
    }

    const textAfterCode = line.substring(line.indexOf(code) + 5).trim();
    if (textAfterCode.length >= 2 && /^[a-zA-Z\s-]+$/.test(textAfterCode)) {
      score += 0.3;
    }
  }

  return Math.min(score, 1);
}

function scoreAsStreet(line: string): number {
  let score = 0;

  // CRITICAL: Reject tracking codes (sequences like "1069 4001 5857 77")
  // These are NOT addresses - they are parcel tracking numbers
  const trackingCodePattern = /^\d{3,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
  if (trackingCodePattern.test(line.trim())) {
    return 0; // Immediately reject
  }

  // Reject lines that are mostly numbers with spaces (tracking codes)
  const digitsOnly = line.replace(/\D/g, '');
  const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
  if (digitsOnly.length > 8 && letterCount < 3) {
    return 0; // Too many digits, not enough letters = tracking code
  }

  // Reject DPD/carrier reference patterns
  if (/FR-DPD|predict|colls?|poids|ref\s*\d|barcode/i.test(line)) {
    return 0;
  }

  const fuzzyResult = fuzzyMatch(line, STREET_KEYWORDS, 0.7);
  if (fuzzyResult) {
    score += 0.3 + fuzzyResult.score * 0.2;
  }

  if (/^\d+[\s,]/.test(line) || /\b\d+\s*(bis|ter|quater)?\b/i.test(line)) {
    score += 0.25;
  }

  // Street number at START: "56 rue de collonges"
  const streetNumberStartPattern = /^\d{1,4}\s*(bis|ter|quater)?[\s,]+/i;
  if (streetNumberStartPattern.test(line)) {
    score += 0.15;
  }

  // Street number at END: "rue de collonges 56" or "rue de collonges 56 bis"
  const streetNumberEndPattern = /\s+\d{1,4}\s*(bis|ter|quater)?\s*$/i;
  if (streetNumberEndPattern.test(line)) {
    score += 0.15;
  }

  if (/\b\d{5}\b/.test(line)) {
    score -= 0.3;
  }

  return Math.max(0, Math.min(score, 1));
}

function scoreAsName(line: string): number {
  let score = 0;

  const words = line.toLowerCase().split(/\s+/).filter(w => w.length > 1);

  for (const word of words) {
    if (fuzzyContains(word, CIVILITY_PREFIXES, 0.8)) {
      score += 0.3;
      break;
    }
  }

  for (const word of words) {
    if (FRENCH_FIRST_NAMES.has(word)) {
      score += 0.4;
      break;
    }
    const fuzzyName = fuzzyMatch(word, Array.from(FRENCH_FIRST_NAMES), 0.8);
    if (fuzzyName) {
      score += 0.3;
      break;
    }
  }

  if (words.length >= 2 && words.length <= 4) {
    const allAlphabetic = words.every(w => /^[a-z\-']+$/.test(w));
    if (allAlphabetic) {
      score += 0.25;
    }
  }

  const isAllCaps = /^[A-Z\s\-']+$/.test(line.trim()) && line.trim().length > 3;
  if (isAllCaps && words.length >= 2 && words.length <= 4) {
    score += 0.2;
  }

  if (/\d/.test(line)) {
    score -= 0.5;
  }

  if (fuzzyContains(line.toLowerCase(), STREET_KEYWORDS, 0.75)) {
    score -= 0.6;
  }

  return Math.max(0, Math.min(score, 1));
}

function scoreAsAnnex(line: string): number {
  let score = 0;

  const fuzzyResult = fuzzyMatch(line, ANNEX_KEYWORDS, 0.75);
  if (fuzzyResult) {
    score += 0.4 + fuzzyResult.score * 0.2;
  }

  if (/\b(bat|bât|esc|app?t?|porte|etg?|ent)\s*\.?\s*[a-zA-Z0-9]/i.test(line)) {
    score += 0.25;
  }

  if (/\b\d{1,3}\s*(er|eme|ème|e)\s*(etage|étage)?/i.test(line)) {
    score += 0.2;
  }

  if (/\bcode\s*:?\s*[a-zA-Z0-9#*]+/i.test(line)) {
    score += 0.15;
  }

  return Math.min(score, 1);
}

function scoreAsCompany(line: string): number {
  let score = 0;

  const fuzzyResult = fuzzyMatch(line, COMPANY_INDICATORS, 0.8);
  if (fuzzyResult) {
    score += 0.4 + fuzzyResult.score * 0.2;
  }

  if (/\b(sarl|sas|sa|eurl|sasu|sci|snc)\b/i.test(line)) {
    score += 0.35;
  }

  if (/^[A-Z\s&]+$/.test(line) && line.length > 5) {
    score += 0.15;
  }

  if (/\b(chez|c\/o)\b/i.test(line)) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

function classifyLine(line: string, index: number): LineClassification {
  const scores: Record<LineType, number> = {
    phone: scoreAsPhone(line),
    postal: scoreAsPostal(line),
    street: scoreAsStreet(line),
    name: scoreAsName(line),
    annex: scoreAsAnnex(line),
    company: scoreAsCompany(line),
    unknown: 0.1,
  };

  let bestType: LineType = 'unknown';
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores) as [LineType, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return {
    type: bestType,
    score: bestScore,
    content: line,
    originalIndex: index,
  };
}

function classifyAllLines(lines: string[]): LineClassification[] {
  return lines.map((line, index) => classifyLine(line, index));
}

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

function extractPhone(context: ExtractionContext): Candidate<string>[] {
  const candidates: Candidate<string>[] = [];

  // Priority 1: Phone after TEL:/TELEPHONE: keyword (highest confidence)
  const telKeywordPattern = /(?:tel|téléphone|telephone|phone|contact)\s*[:\.]?\s*((?:0|\+33|0033)\s*[1-9](?:[\s.\-]?\d{2}){4}|\d{10,11})/gi;
  const telMatches = context.fullText.match(telKeywordPattern);
  if (telMatches) {
    for (const match of telMatches) {
      const numberPart = match.replace(/^(?:tel|téléphone|telephone|phone|contact)\s*[:\.]?\s*/i, '');
      const normalized = numberPart.replace(/[\s.\-]/g, '').replace(/^\+33/, '0').replace(/^0033/, '0');
      if (normalized.length >= 10 && normalized.length <= 11) {
        const finalNumber = normalized.length === 11 && normalized.startsWith('33')
          ? '0' + normalized.slice(2)
          : normalized.slice(0, 10);
        if (/^0[1-9]/.test(finalNumber)) {
          candidates.push({
            value: finalNumber,
            score: 0.95,
            source: 'line',
          });
        }
      }
    }
  }

  const patterns = [
    /(?:0|\+33|0033)\s*[1-9](?:[\s.\-]?\d{2}){4}/g,
    /\b0[1-9](?:\d{2}){4}\b/g,
    // Format "33XXXXXXXXX" (11 digits starting with 33)
    /\b33[1-9](?:\d{2}){4}\b/g,
  ];

  for (const classification of context.classifications) {
    if (classification.type === 'phone' && classification.score > 0.5) {
      for (const pattern of patterns) {
        const matches = classification.content.match(pattern);
        if (matches) {
          for (const match of matches) {
            let normalized = match.replace(/[\s.\-]/g, '').replace(/^\+33/, '0').replace(/^0033/, '0');
            // Handle "33XXXXXXXXX" format (11 digits starting with 33)
            if (normalized.length === 11 && /^33[1-9]/.test(normalized)) {
              normalized = '0' + normalized.slice(2);
            }
            if (normalized.length === 10 && /^0[1-9]/.test(normalized)) {
              const exists = candidates.some(c => c.value === normalized);
              if (!exists) {
                candidates.push({
                  value: normalized,
                  score: classification.score,
                  source: 'line',
                });
              }
            }
          }
        }
      }
    }
  }

  for (const pattern of patterns) {
    const matches = context.fullTextNoBreaks.match(pattern);
    if (matches) {
      for (const match of matches) {
        let normalized = match.replace(/[\s.\-]/g, '').replace(/^\+33/, '0').replace(/^0033/, '0');
        // Handle "33XXXXXXXXX" format (11 digits starting with 33)
        if (normalized.length === 11 && /^33[1-9]/.test(normalized)) {
          normalized = '0' + normalized.slice(2);
        }
        if (normalized.length === 10 && /^0[1-9]/.test(normalized)) {
          const exists = candidates.some(c => c.value === normalized);
          if (!exists) {
            // Filter out tracking codes (UPS, FedEx, etc)
            const matchIndex = context.fullTextNoBreaks.indexOf(match);
            const before = context.fullTextNoBreaks.slice(Math.max(0, matchIndex - 10), matchIndex);
            const after = context.fullTextNoBreaks.slice(matchIndex + match.length, matchIndex + match.length + 10);
            const context10 = before + after;

            // Tracking code indicators
            const isTrackingCode =
              /1Z|UPS|FEDEX|DHL|CHRONOPOST|COLISSIMO|TNT/i.test(context10) ||
              /[A-Z]{3,}\d{2,}|#\s*\d|TRACKING/i.test(context10) ||
              /\d{2}[A-Z]\d{2}[A-Z]/i.test(context10);  // Pattern like "20F04"

            // Mobile phones (06, 07) get higher priority
            let score = 0.5;
            if (/^0[67]/.test(normalized)) {
              score = 0.7;
            }

            if (!isTrackingCode) {
              candidates.push({
                value: normalized,
                score,
                source: 'global',
              });
            }
          }
        }
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function extractPostalCity(context: ExtractionContext): { postal: Candidate<string>[]; city: Candidate<string>[] } {
  const postalCandidates: Candidate<string>[] = [];
  const cityCandidates: Candidate<string>[] = [];

  const postalCityPattern = /\b(\d{5})\s+([a-zA-Z][a-zA-Z\s\-']+)/g;

  for (const classification of context.classifications) {
    if (classification.type === 'postal' && classification.score > 0.3) {
      let match;
      const regex = new RegExp(postalCityPattern.source, 'gi');
      while ((match = regex.exec(classification.content)) !== null) {
        const postal = match[1];
        const city = match[2].trim();

        postalCandidates.push({
          value: postal,
          score: classification.score,
          source: 'line',
        });

        let cityScore = classification.score * 0.8;
        const normalizedCity = normalizeCityName(city);
        const cityWithHyphens = normalizedCity.replace(/\s/g, '-');

        // Check against known cities with both space and hyphen variants
        if (MAJOR_FRENCH_CITIES.has(normalizedCity) || MAJOR_FRENCH_CITIES.has(cityWithHyphens)) {
          cityScore += 0.3;
        }

        const fuzzyCity = fuzzyMatch(normalizedCity, Array.from(MAJOR_FRENCH_CITIES), 0.75);
        if (fuzzyCity) {
          cityScore += 0.2;
        }

        // Clean city name: remove trailing department code and format for display
        const cleanedCity = cleanCityName(city);
        const cleanCity = cleanedCity.replace(/\s*-\s*/g, '-').split(/[\s-]+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join('-');

        cityCandidates.push({
          value: cleanCity,
          score: Math.min(cityScore, 1),
          source: 'line',
        });
      }
    }
  }

  let match;
  const globalRegex = new RegExp(postalCityPattern.source, 'gi');
  while ((match = globalRegex.exec(context.fullTextNoBreaks)) !== null) {
    const postal = match[1];
    const city = match[2].trim();

    const postalExists = postalCandidates.some(c => c.value === postal);
    if (!postalExists) {
      postalCandidates.push({
        value: postal,
        score: 0.5,
        source: 'global',
      });
    }

    // Clean city name: remove trailing department code
    const cleanedCity = cleanCityName(city);
    const formattedCity = cleanedCity.replace(/\s*-\s*/g, '-').split(/[\s-]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('-');

    const cityExists = cityCandidates.some(c => c.value.toLowerCase() === formattedCity.toLowerCase());
    if (!cityExists) {
      cityCandidates.push({
        value: formattedCity,
        score: 0.5,
        source: 'global',
      });
    }
  }

  return {
    postal: postalCandidates.sort((a, b) => b.score - a.score),
    city: cityCandidates.sort((a, b) => b.score - a.score),
  };
}

function extractStreet(context: ExtractionContext): Candidate<string>[] {
  const candidates: Candidate<string>[] = [];

  // Helper to check if string looks like a tracking code
  const isTrackingCode = (str: string): boolean => {
    const digitsOnly = str.replace(/\D/g, '');
    const letterCount = (str.match(/[a-zA-Z]/g) || []).length;
    // Tracking codes have many digits and few letters
    if (digitsOnly.length > 8 && letterCount < 3) return true;
    // Pattern like "1069 4001 5857"
    if (/^\d{3,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/.test(str.trim())) return true;
    // DPD/carrier patterns
    if (/FR-DPD|predict|colls?|poids|ref\s*\d|barcode/i.test(str)) return true;
    return false;
  };

  for (const classification of context.classifications) {
    if (classification.type === 'street' && classification.score > 0.3) {
      let streetValue = classification.content;

      // Skip tracking codes
      if (isTrackingCode(streetValue)) continue;

      // Remove postal code and everything after
      streetValue = streetValue.replace(/\s+\d{5}\s+[a-zA-ZÀ-ÿ].*/g, '').trim();
      // Remove leading phone numbers (10 digits starting with 0)
      streetValue = streetValue.replace(/^0\d{9}\s+/, '').trim();
      // Remove company names before street number (ALL CAPS words before number)
      streetValue = streetValue.replace(/^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ\s]{4,}\s+(?=\d)/g, '').trim();

      // Normalize street number position (move from end to start if needed)
      streetValue = normalizeStreetNumberPosition(streetValue);

      if (streetValue.length > 3 && streetValue.length < 60) {
        candidates.push({
          value: streetValue,
          score: classification.score,
          source: 'line',
        });
      }
    }
  }

  const streetPatterns = [
    // Pattern with street number first: "8 RUE DE LA PAIX" (stop before postal code)
    /(\d{1,4}\s*(bis|ter|quater)?\s*,?\s*(rue|avenue|boulevard|place|chemin|route|rte|allée|impasse|passage|square|cours|quai|voie|av|bd)\s+[a-zA-ZÀ-ÿ'\-\s]{3,35})(?=\s+\d{5}|$|\s*,)/gi,
    // Pattern with street number LAST: "rue de collonges 56"
    /((rue|avenue|boulevard|place|chemin|route|rte|allée|impasse|passage|square|cours|quai|voie|av|bd)\s+[a-zA-ZÀ-ÿ'\-\s]{3,30}\s+\d{1,4}\s*(bis|ter|quater)?)(?=\s+\d{5}|$|\s*,)/gi,
    // Pattern without number: "RUE DE L'ESPERANCE" (stop before postal code)
    /((rue|avenue|boulevard|place|chemin|route|rte|allée|impasse|passage|square|cours|quai|voie|av|bd)\s+[a-zA-ZÀ-ÿ'\-\s]{3,35})(?=\s+\d{5}|$|\s*,)/gi,
  ];

  // Helper to clean street value
  const cleanStreet = (raw: string): string => {
    let cleaned = raw.trim();
    // Remove trailing postal code
    cleaned = cleaned.replace(/\s+\d{5}.*$/, '');
    // Remove leading phone numbers
    cleaned = cleaned.replace(/^0\d{9}\s*/, '');
    // Remove company names at start (all caps before street keyword)
    cleaned = cleaned.replace(/^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ\s]{3,}(?=\d|$)/i, (match) => {
      if (/(rue|avenue|boulevard|chemin|route|place)/i.test(match)) return match;
      return '';
    });
    // Normalize street number position (move from end to start)
    cleaned = normalizeStreetNumberPosition(cleaned);
    return cleaned.trim();
  };

  for (const pattern of streetPatterns) {
    let match;
    const regex = new RegExp(pattern.source, 'gi');
    while ((match = regex.exec(context.fullTextNoBreaks)) !== null) {
      const street = cleanStreet(match[1]);
      const exists = candidates.some(c => stringSimilarity(c.value.toLowerCase(), street.toLowerCase()) > 0.8);
      if (!exists && street.length > 5 && street.length < 60) {
        candidates.push({
          value: street,
          score: 0.5,
          source: 'global',
        });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function extractName(context: ExtractionContext): { firstName: Candidate<string>[]; lastName: Candidate<string>[] } {
  const firstNameCandidates: Candidate<string>[] = [];
  const lastNameCandidates: Candidate<string>[] = [];

  for (const classification of context.classifications) {
    if (classification.type === 'name' && classification.score > 0.2) {
      let content = classification.content;

      for (const civility of CIVILITY_PREFIXES) {
        const regex = new RegExp(`^\\s*${escapeRegex(civility)}\\.?\\s*`, 'gi');
        content = content.replace(regex, '');
      }

      const words = content.trim().split(/\s+/).filter(w => w.length > 1 && /^[a-zA-Z\-']+$/.test(w));

      if (words.length >= 1) {
        const firstWord = words[0];
        const normalizedFirst = firstWord.toLowerCase();

        let firstNameScore = classification.score * 0.6;
        if (FRENCH_FIRST_NAMES.has(normalizedFirst)) {
          firstNameScore += 0.35;
        } else if (fuzzyMatch(normalizedFirst, Array.from(FRENCH_FIRST_NAMES), 0.8)) {
          firstNameScore += 0.2;
        }

        firstNameCandidates.push({
          value: capitalize(firstWord),
          score: Math.min(firstNameScore, 1),
          source: 'line',
        });

        if (words.length >= 2) {
          const lastName = words.slice(1).map(capitalize).join(' ');
          lastNameCandidates.push({
            value: lastName,
            score: classification.score * 0.8,
            source: 'line',
          });
        }
      }
    }
  }

  if (firstNameCandidates.length === 0) {
    for (const line of context.normalizedLines) {
      const cleanLine = line.replace(/^(m\.|mr|mme|mlle|monsieur|madame|mademoiselle)\s*/gi, '').trim();
      const words = cleanLine.split(/\s+/).filter(w => w.length > 1 && /^[a-zA-Z\-']+$/i.test(w));

      if (words.length >= 2 && words.length <= 4 && !/\d/.test(cleanLine)) {
        const hasStreetKeyword = STREET_KEYWORDS.some(kw =>
          cleanLine.toLowerCase().includes(kw) || stringSimilarity(cleanLine.toLowerCase(), kw) > 0.7
        );

        if (!hasStreetKeyword) {
          const firstWord = words[0];
          const normalizedFirst = firstWord.toLowerCase();

          let score = 0.3;
          if (FRENCH_FIRST_NAMES.has(normalizedFirst)) {
            score = 0.7;
          } else if (fuzzyMatch(normalizedFirst, Array.from(FRENCH_FIRST_NAMES), 0.8)) {
            score = 0.5;
          }

          firstNameCandidates.push({
            value: capitalize(firstWord),
            score,
            source: 'global',
          });

          if (words.length >= 2) {
            lastNameCandidates.push({
              value: words.slice(1).map(capitalize).join(' '),
              score: score * 0.9,
              source: 'global',
            });
          }
        }
      }
    }
  }

  return {
    firstName: firstNameCandidates.sort((a, b) => b.score - a.score),
    lastName: lastNameCandidates.sort((a, b) => b.score - a.score),
  };
}

function extractCompany(context: ExtractionContext): Candidate<string>[] {
  const candidates: Candidate<string>[] = [];

  for (const classification of context.classifications) {
    if (classification.type === 'company' && classification.score > 0.3) {
      candidates.push({
        value: classification.content,
        score: classification.score,
        source: 'line',
      });
    }
  }

  const companyPatterns = [
    /\b(sarl|sas|sa|eurl|sasu|sci|snc)\s+[^,\n]+/gi,
    /\b(ets|etablissements|établissements)\s+[^,\n]+/gi,
    /\b(societe|société|ste)\s+[^,\n]+/gi,
  ];

  for (const pattern of companyPatterns) {
    let match;
    const regex = new RegExp(pattern.source, 'gi');
    while ((match = regex.exec(context.fullTextNoBreaks)) !== null) {
      const company = match[0].trim();
      const exists = candidates.some(c => stringSimilarity(c.value.toLowerCase(), company.toLowerCase()) > 0.8);
      if (!exists) {
        candidates.push({
          value: company,
          score: 0.6,
          source: 'global',
        });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function extractAnnex(context: ExtractionContext): Candidate<string>[] {
  const candidates: Candidate<string>[] = [];

  for (const classification of context.classifications) {
    if (classification.type === 'annex' && classification.score > 0.3) {
      candidates.push({
        value: classification.content,
        score: classification.score,
        source: 'line',
      });
    }
  }

  const annexPatterns = [
    /\b(bat|bât|batiment|bâtiment)\s*\.?\s*[a-zA-Z0-9]+/gi,
    /\b(esc|escalier)\s*\.?\s*[a-zA-Z0-9]+/gi,
    /\b(app?t?|appartement)\s*\.?\s*\d+/gi,
    /\b\d{1,3}\s*(er|eme|ème|e)\s*(etage|étage)/gi,
    /\b(porte|pte)\s*\.?\s*\d+/gi,
    /\bcode\s*:?\s*[a-zA-Z0-9#*]+/gi,
    /\bdigicode\s*:?\s*[a-zA-Z0-9#*]+/gi,
  ];

  for (const pattern of annexPatterns) {
    let match;
    const regex = new RegExp(pattern.source, 'gi');
    while ((match = regex.exec(context.fullTextNoBreaks)) !== null) {
      const annex = match[0].trim();
      const exists = candidates.some(c => stringSimilarity(c.value.toLowerCase(), annex.toLowerCase()) > 0.8);
      if (!exists) {
        candidates.push({
          value: annex,
          score: 0.5,
          source: 'global',
        });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// =============================================================================
// ADDRESS BUILDING
// =============================================================================

function buildAddress(candidates: FieldCandidates): ParsedAddress {
  const firstName = selectBestCandidate(candidates.firstName);
  const lastName = selectBestCandidate(candidates.lastName);
  const companyName = selectBestCandidate(candidates.companyName);
  const street = selectBestCandidate(candidates.street);
  const addressAnnex = selectBestCandidate(candidates.addressAnnex);
  const postalCode = selectBestCandidate(candidates.postalCode);
  const city = selectBestCandidate(candidates.city);
  const phoneNumber = selectBestCandidate(candidates.phoneNumber);

  const fullAddressParts: string[] = [];
  if (street) fullAddressParts.push(street);
  if (addressAnnex) fullAddressParts.push(addressAnnex);
  if (postalCode && city) {
    fullAddressParts.push(`${postalCode} ${city}`);
  } else if (postalCode) {
    fullAddressParts.push(postalCode);
  } else if (city) {
    fullAddressParts.push(city);
  }

  const confidence = computeConfidence(candidates, {
    firstName: firstName || '',
    lastName: lastName || '',
    companyName: companyName || '',
    street: street || '',
    addressAnnex: addressAnnex || '',
    postalCode: postalCode || '',
    city: city || '',
    phoneNumber: phoneNumber || '',
    fullAddress: fullAddressParts.join(', '),
  });

  return {
    firstName: firstName || '',
    lastName: lastName || '',
    companyName: companyName || '',
    street: street || '',
    addressAnnex: addressAnnex || '',
    postalCode: postalCode || '',
    city: city || '',
    phoneNumber: phoneNumber || '',
    fullAddress: fullAddressParts.join(', '),
    confidence,
  };
}

function selectBestCandidate(candidates: Candidate<string>[]): string {
  if (candidates.length === 0) return '';

  const filtered = candidates.filter(c => c.value && c.value.trim().length > 0);
  if (filtered.length === 0) return '';

  return filtered[0].value;
}

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

function computeConfidence(candidates: FieldCandidates, result: Omit<ParsedAddress, 'confidence'>): number {
  let score = 0;
  let maxPossible = 0;

  const fieldWeights: Record<string, number> = {
    street: 0.25,
    postalCode: 0.2,
    city: 0.2,
    phoneNumber: 0.1,
    firstName: 0.1,
    lastName: 0.1,
    companyName: 0.05,
  };

  for (const [field, weight] of Object.entries(fieldWeights)) {
    maxPossible += weight;

    const candidateList = candidates[field as keyof FieldCandidates];
    const resultValue = result[field as keyof typeof result];

    if (resultValue && resultValue.length > 0 && candidateList.length > 0) {
      const bestScore = candidateList[0].score;
      score += weight * bestScore;
    }
  }

  if (result.postalCode && result.city) {
    score += 0.1;
  }

  if (result.street && (result.postalCode || result.city)) {
    score += 0.1;
  }

  if (!result.street && !result.postalCode && !result.city) {
    score *= 0.3;
  }

  if (candidates.firstName.length > 3 || candidates.lastName.length > 3) {
    score *= 0.95;
  }

  if (candidates.postalCode.length > 2) {
    const uniquePostals = new Set(candidates.postalCode.map(c => c.value));
    if (uniquePostals.size > 1) {
      score *= 0.9;
    }
  }

  return Math.max(0, Math.min(1, score));
}

// =============================================================================
// MAIN PARSER (with memoization cache)
// =============================================================================

// OPTIMIZATION: Memoization cache for parsed results
const parseCache = new Map<string, ParsedAddress>();
const CACHE_MAX_SIZE = 50; // Keep last 50 results

function getCacheKey(text: string): string {
  // Normalize text for cache key (trim, collapse whitespace)
  return text.trim().replace(/\s+/g, ' ').substring(0, 500);
}

export function parseOCRText(rawText: string): ParsedAddress {
  if (!rawText || typeof rawText !== 'string') {
    return createEmptyResult();
  }

  // OPTIMIZATION: Check cache first
  const cacheKey = getCacheKey(rawText);
  const cached = parseCache.get(cacheKey);
  if (cached) {
    return { ...cached }; // Return copy to avoid mutations
  }

  const { lines, fullText } = tokenize(rawText);

  if (lines.length === 0) {
    return createEmptyResult();
  }

  const classifications = classifyAllLines(lines);

  const context: ExtractionContext = {
    normalizedText: fullText,
    normalizedLines: lines,
    originalLines: rawText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0),
    fullText: fullText,
    fullTextNoBreaks: fullText.replace(/\s+/g, ' '),
    classifications,
  };

  const phoneCandidates = extractPhone(context);
  const { postal: postalCandidates, city: cityCandidates } = extractPostalCity(context);
  const streetCandidates = extractStreet(context);
  const { firstName: firstNameCandidates, lastName: lastNameCandidates } = extractName(context);
  const companyCandidates = extractCompany(context);
  const annexCandidates = extractAnnex(context);

  const candidates: FieldCandidates = {
    firstName: firstNameCandidates,
    lastName: lastNameCandidates,
    companyName: companyCandidates,
    street: streetCandidates,
    addressAnnex: annexCandidates,
    postalCode: postalCandidates,
    city: cityCandidates,
    phoneNumber: phoneCandidates,
  };

  const result = buildAddress(candidates);
  result.rawText = rawText; // Store original for debugging

  // OPTIMIZATION: Store in cache (with size limit)
  if (parseCache.size >= CACHE_MAX_SIZE) {
    // Remove oldest entry
    const firstKey = parseCache.keys().next().value;
    if (firstKey) parseCache.delete(firstKey);
  }
  parseCache.set(cacheKey, { ...result });

  return result;
}

function createEmptyResult(): ParsedAddress {
  return {
    firstName: '',
    lastName: '',
    companyName: '',
    street: '',
    addressAnnex: '',
    postalCode: '',
    city: '',
    phoneNumber: '',
    fullAddress: '',
    confidence: 0,
  };
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export function hasValidAddress(result: ParsedAddress): boolean {
  const hasStreet = result.street.length > 3;
  const hasPostal = /^\d{5}$/.test(result.postalCode);
  const hasCity = result.city.length > 1;

  const hasMinimalAddress = hasStreet || (hasPostal && hasCity);

  return hasMinimalAddress && result.confidence > 0.3;
}

export function areResultsSimilar(a: ParsedAddress, b: ParsedAddress, threshold: number = 0.8): boolean {
  const fieldsToCompare: (keyof ParsedAddress)[] = [
    'street', 'postalCode', 'city', 'phoneNumber',
  ];

  let matchCount = 0;
  let totalWeight = 0;

  const weights: Record<string, number> = {
    street: 0.35,
    postalCode: 0.25,
    city: 0.25,
    phoneNumber: 0.15,
  };

  for (const field of fieldsToCompare) {
    const weight = weights[field] || 0.25;
    totalWeight += weight;

    const valA = String(a[field] || '').toLowerCase().trim();
    const valB = String(b[field] || '').toLowerCase().trim();

    if (valA === '' && valB === '') {
      matchCount += weight;
    } else if (valA === '' || valB === '') {
      continue;
    } else {
      const similarity = stringSimilarity(valA, valB);
      matchCount += weight * similarity;
    }
  }

  return totalWeight > 0 && (matchCount / totalWeight) >= threshold;
}

// =============================================================================
// REACT HOOK (for React Native integration)
// =============================================================================

export function useOCRParsing() {
  return {
    parseOCRText,
    hasValidAddress,
    areResultsSimilar,
  };
}

export default useOCRParsing;
