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
    
    // Log the current directory and script path for debugging
    console.log('Current working directory:', process.cwd());
    console.log('Looking for Python script at:', scriptPath);
    
    // Make sure the script exists and is executable
    if (!fs.existsSync(scriptPath)) {
      console.error(`Python script not found at path: ${scriptPath}`);
      return reject(new Error(`Python script not found: ${scriptPath}`));
    }
    
    // Make the script executable (if not already)
    try {
      fs.chmodSync(scriptPath, '755');
      console.log(`Made Python script executable: ${scriptPath}`);
    } catch (error) {
      console.warn('Could not make Python script executable:', error);
    }
    
    // Determine Python executable with multiple fallbacks
    const pythonExecutables = [
      process.env.PYTHON_PATH,
      'python3',
      'python',
      '/usr/bin/python3',
      '/usr/local/bin/python3'
    ].filter(Boolean) as string[]; // Filter out undefined values
    
    // Log the potential Python executables for debugging
    console.log('Potential Python executables:', pythonExecutables);
    
    // Try each Python executable until one works
    let pythonExecutable = pythonExecutables[0];
    let pythonProcess;
    
    try {
      // Spawn the Python process
      console.log(`Spawning Python process with: ${pythonExecutable} ${scriptPath}`);
      pythonProcess = spawn(pythonExecutable, [scriptPath]);
      
      let output = '';
      let errorOutput = '';
      
      // Collect standard output
      pythonProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        console.log('Python stdout chunk:', chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''));
        output += chunk;
      });
      
      // Collect error output
      pythonProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        console.error('Python stderr:', chunk);
        errorOutput += chunk;
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code: ${code}`);
        
        if (code !== 0) {
          console.error('Python process error output:', errorOutput);
          return reject(new Error(`Python process failed with code ${code}: ${errorOutput}`));
        }
        
        try {
          // Parse the JSON output
          console.log('Python output length:', output.length);
          console.log('Python output preview:', output.substring(0, 200) + (output.length > 200 ? '...' : ''));
          
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
    } catch (error) {
      console.error('Error spawning Python process:', error);
      reject(new Error(`Failed to spawn Python process: ${error}`));
    }
  });
}

/**
 * Check if Python data processor is available
 * Returns true if Python and required dependencies are installed
 */
export async function isPythonDataProcessorAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Try multiple potential Python executables
      const pythonExecutables = [
        process.env.PYTHON_PATH, 
        'python3',
        'python',
        '/usr/bin/python3',
        '/usr/local/bin/python3'
      ].filter(Boolean) as string[]; // Filter out undefined values
      
      console.log('Checking Python availability with executables:', pythonExecutables);
      
      // Try each Python executable
      let checked = 0;
      let pythonFound = false;
      
      for (const pythonExecutable of pythonExecutables) {
        try {
          console.log(`Trying Python executable: ${pythonExecutable}`);
          
          // Simple test command to check if Python dependencies are available
          const pythonProcess = spawn(pythonExecutable, ['-c', 'import pandas, numpy; print("OK")']);
          
          let output = '';
          let errorOutput = '';
          
          pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          pythonProcess.on('close', (code) => {
            checked++;
            
            if (code === 0 && output.trim() === 'OK') {
              console.log(`Python is available with ${pythonExecutable}`);
              process.env.PYTHON_PATH = pythonExecutable; // Set the working executable
              pythonFound = true;
              resolve(true);
            } else if (checked === pythonExecutables.length && !pythonFound) {
              console.warn(`None of the Python executables worked. Last attempt errors:`, errorOutput);
              resolve(false);
            }
          });
          
          pythonProcess.on('error', (error) => {
            console.warn(`Failed to execute ${pythonExecutable}:`, error.message);
            checked++;
            if (checked === pythonExecutables.length && !pythonFound) {
              resolve(false);
            }
          });
        } catch (execError) {
          console.warn(`Exception trying ${pythonExecutable}:`, execError);
          checked++;
          if (checked === pythonExecutables.length && !pythonFound) {
            resolve(false);
          }
        }
      }
    } catch (error) {
      console.warn('Error checking Python availability:', error);
      resolve(false);
    }
  });
} 