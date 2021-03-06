var replace = require('replace-in-file');
const buildTime = new Date().toLocaleString();
const options = {
  files: process.argv[2],
  from: /version:.*/gm,
  to: (match) => `version: '${buildTime}',`
};

try {
  console.log(buildTime);
  replace.sync(options)
}
catch (error) {
  console.error('Error occurred:', error);
}
