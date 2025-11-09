// Test script to check if electron-builder requires icons
const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, 'electron', 'resources');
console.log('Checking icon path:', iconPath);
console.log('Icons exist:', fs.existsSync(iconPath));

if (fs.existsSync(iconPath)) {
  const files = fs.readdirSync(iconPath);
  console.log('Files in resources:', files);
  
  const requiredIcons = ['icon.icns', 'icon.ico', 'icon.png'];
  const missingIcons = requiredIcons.filter(icon => !files.includes(icon));
  
  if (missingIcons.length > 0) {
    console.log('Missing required icons:', missingIcons);
    console.log('electron-builder may use default icons or fail during build');
  } else {
    console.log('All required icons are present');
  }
}
