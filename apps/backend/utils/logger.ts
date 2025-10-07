// Simple console logger
const logger = {
  info: (message: any, meta?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} [INFO]: ${message}`, meta ? JSON.stringify(meta) : '');
  },
  error: (message: any, meta?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} [ERROR]: ${message}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (message: any, meta?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`${timestamp} [WARN]: ${message}`, meta ? JSON.stringify(meta) : '');
  },
  debug: (message: any, meta?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} [DEBUG]: ${message}`, meta ? JSON.stringify(meta) : '');
  }
};

export default logger;