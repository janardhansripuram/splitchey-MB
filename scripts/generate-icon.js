const fs = require('fs');
const path = require('path');

// Create a simple SVG icon for SplitChey
const svgIcon = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="512" cy="512" r="480" fill="url(#grad1)"/>
  
  <!-- Dollar sign -->
  <text x="512" y="400" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">$</text>
  
  <!-- Split lines -->
  <line x1="300" y1="600" x2="724" y2="600" stroke="white" stroke-width="8" stroke-linecap="round"/>
  <line x1="400" y1="650" x2="624" y2="650" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <line x1="450" y1="700" x2="574" y2="700" stroke="white" stroke-width="4" stroke-linecap="round"/>
  
  <!-- Small circles representing people -->
  <circle cx="350" cy="750" r="25" fill="white"/>
  <circle cx="450" cy="750" r="25" fill="white"/>
  <circle cx="550" cy="750" r="25" fill="white"/>
  <circle cx="650" cy="750" r="25" fill="white"/>
</svg>
`;

// Write the SVG file
const svgPath = path.join(__dirname, '../assets/images/icon.svg');
fs.writeFileSync(svgPath, svgIcon);

console.log('✅ Generated SVG icon at:', svgPath);
console.log('📝 Note: You may want to convert this SVG to PNG using a tool like:');
console.log('   - Online SVG to PNG converter');
console.log('   - Image editing software');
console.log('   - Command line tools like ImageMagick');
console.log('');
console.log('🎨 The icon features:');
console.log('   - Gradient background (purple to blue)');
console.log('   - Dollar sign representing money');
console.log('   - Split lines representing expense splitting');
console.log('   - People circles representing group expenses'); 