import fs from 'fs/promises';
import path from 'path';

export function parseDate(dateStr: string | null): string {
  if (!dateStr) return new Date().toISOString();
  
  try {
    // Handle relative dates
    if (dateStr.includes('ago') || dateStr.includes('hours') || dateStr.includes('minutes')) {
      return new Date().toISOString();
    }
    
    // Try parsing the date
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) {
      return new Date().toISOString();
    }
    
    return parsedDate.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

export async function saveToFile(data: any, filename: string): Promise<void> {
  try {
    // Ensure the output directory exists
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    // Save the file
    const filePath = path.join(outputDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Data successfully saved to ${filePath}`);
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
}
