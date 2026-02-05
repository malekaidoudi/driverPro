import AsyncStorage from '@react-native-async-storage/async-storage';

const OCR_TEST_LOG_KEY = '@ocr_test_logs';
const MAX_LOGS = 100;

export interface OCRTestLog {
  id: string;
  timestamp: string;
  rawText: string;
  parsedResult: {
    street?: string;
    postalCode?: string;
    city?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  isCorrect?: boolean;
  notes?: string;
}

export async function logOCRTest(
  rawText: string,
  parsedResult: OCRTestLog['parsedResult'],
  isCorrect?: boolean,
  notes?: string
): Promise<void> {
  try {
    const log: OCRTestLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      rawText: rawText.substring(0, 500), // Limit size
      parsedResult,
      isCorrect,
      notes,
    };

    const existingLogs = await getOCRTestLogs();
    const updatedLogs = [log, ...existingLogs].slice(0, MAX_LOGS);
    
    await AsyncStorage.setItem(OCR_TEST_LOG_KEY, JSON.stringify(updatedLogs));
    
    if (__DEV__) {
      console.log(`[OCR-LOG] Saved test log #${updatedLogs.length}`);
    }
  } catch (error) {
    console.error('[OCR-LOG] Failed to save log:', error);
  }
}

export async function getOCRTestLogs(): Promise<OCRTestLog[]> {
  try {
    const data = await AsyncStorage.getItem(OCR_TEST_LOG_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[OCR-LOG] Failed to read logs:', error);
    return [];
  }
}

export async function clearOCRTestLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OCR_TEST_LOG_KEY);
    console.log('[OCR-LOG] Logs cleared');
  } catch (error) {
    console.error('[OCR-LOG] Failed to clear logs:', error);
  }
}

export async function exportOCRTestLogs(): Promise<string> {
  const logs = await getOCRTestLogs();
  
  let report = `# OCR Test Report\n`;
  report += `Generated: ${new Date().toLocaleString()}\n`;
  report += `Total tests: ${logs.length}\n\n`;
  
  const correct = logs.filter(l => l.isCorrect === true).length;
  const incorrect = logs.filter(l => l.isCorrect === false).length;
  const unmarked = logs.filter(l => l.isCorrect === undefined).length;
  
  report += `## Summary\n`;
  report += `- ✅ Correct: ${correct}\n`;
  report += `- ❌ Incorrect: ${incorrect}\n`;
  report += `- ⚪ Unmarked: ${unmarked}\n\n`;
  
  report += `## Details\n\n`;
  
  for (const log of logs) {
    const status = log.isCorrect === true ? '✅' : log.isCorrect === false ? '❌' : '⚪';
    report += `### ${status} ${log.timestamp}\n`;
    report += `**Raw OCR:**\n\`\`\`\n${log.rawText}\n\`\`\`\n`;
    report += `**Parsed:**\n`;
    report += `- Street: ${log.parsedResult.street || '(empty)'}\n`;
    report += `- Postal: ${log.parsedResult.postalCode || '(empty)'}\n`;
    report += `- City: ${log.parsedResult.city || '(empty)'}\n`;
    report += `- Name: ${log.parsedResult.firstName || ''} ${log.parsedResult.lastName || ''}\n`;
    report += `- Phone: ${log.parsedResult.phone || '(empty)'}\n`;
    if (log.notes) {
      report += `- Notes: ${log.notes}\n`;
    }
    report += `\n---\n\n`;
  }
  
  return report;
}

export async function markLastLogAs(isCorrect: boolean, notes?: string): Promise<void> {
  try {
    const logs = await getOCRTestLogs();
    if (logs.length > 0) {
      logs[0].isCorrect = isCorrect;
      if (notes) logs[0].notes = notes;
      await AsyncStorage.setItem(OCR_TEST_LOG_KEY, JSON.stringify(logs));
    }
  } catch (error) {
    console.error('[OCR-LOG] Failed to mark log:', error);
  }
}
