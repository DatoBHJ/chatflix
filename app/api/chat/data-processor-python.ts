import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Types
export interface DataProcessorRequest {
  data: string;
  format: 'csv' | 'json';
  operation: 'parse' | 'filter' | 'aggregate' | 'transform' | 'analyze';
  options?: Record<string, any>;
}

export interface DataProcessorResponse {
  timestamp: string;
  operation: string;
  format: string;
  data?: any[];
  summary: Record<string, any>;
  error?: string;
}

/**
 * Process data using the Python data processor
 * This is much faster than the JavaScript implementation for large datasets
 */
export async function processPythonData(request: DataProcessorRequest): Promise<DataProcessorResponse> {
  return new Promise((resolve, reject) => {
    // Get the absolute path to the Python script
    const scriptPath = path.join(process.cwd(), 'app', 'python', 'data_processor', 'main.py');
    
    // Make sure the script exists and is executable
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Python script not found: ${scriptPath}`));
    }
    
    // Make the script executable (if not already)
    try {
      fs.chmodSync(scriptPath, '755');
    } catch (error) {
      console.warn('Could not make Python script executable:', error);
    }
    
    // Determine Python executable
    const pythonExecutable = process.env.PYTHON_PATH || 'python3';
    
    // Spawn the Python process
    const pythonProcess = spawn(pythonExecutable, [scriptPath]);
    
    let output = '';
    let errorOutput = '';
    
    // Collect standard output
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // Collect error output
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python process exited with code:', code);
        console.error('Error output:', errorOutput);
        return reject(new Error(`Python process failed with code ${code}: ${errorOutput}`));
      }
      
      try {
        // Parse the JSON output
        const result = JSON.parse(output);
        
        // Check for errors
        if (result.error) {
          console.error('Python data processor error:', result.error);
          console.error('Traceback:', result.traceback);
          return reject(new Error(result.error));
        }
        
        resolve(result);
      } catch (error) {
        console.error('Failed to parse Python output:', error);
        console.error('Raw output:', output);
        reject(error);
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(error);
    });
    
    // Send the request data to the Python process
    pythonProcess.stdin.write(JSON.stringify(request));
    pythonProcess.stdin.end();
  });
}

/**
 * Check if Python data processor is available
 * Returns true if Python and required dependencies are installed
 */
export async function isPythonDataProcessorAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Determine Python executable
      const pythonExecutable = process.env.PYTHON_PATH || 'python3';
      
      // Simple test command to check if Python dependencies are available
      const pythonProcess = spawn(pythonExecutable, ['-c', 'import pandas, numpy; print("OK")']);
      
      let output = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0 && output.trim() === 'OK') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      
      pythonProcess.on('error', () => {
        resolve(false);
      });
    } catch (error) {
      console.warn('Error checking Python availability:', error);
      resolve(false);
    }
  });
} 