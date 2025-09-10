// Script that emits a readiness log line after a delay
const delay = parseInt(process.argv[2] || '250', 10);
console.log(`Starting delayed log process; will log READY_SIGNAL in ${delay}ms`);
setTimeout(() => {
  console.log('READY_SIGNAL');
  // Keep alive briefly so readiness consumers can still query status
  setTimeout(() => {}, 2000);
}, delay);
