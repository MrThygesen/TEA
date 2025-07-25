const fs = require('fs');
const path = require('path');

const folderPath = __dirname;
const outputPath = path.join(folderPath, 'file_list.txt');

const files = fs.readdirSync(folderPath);

// Clear output file before appending
fs.writeFileSync(outputPath, 'List of files in folder:\n\n');

files.forEach(file => {
  fs.appendFileSync(outputPath, file + '\n');
});

console.log(`✅ Done. ${files.length} files written to file_list.txt`);

