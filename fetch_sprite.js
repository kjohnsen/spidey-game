const fs = require('fs');
const https = require('https');

async function fetchSprite() {
  try {
    const searchUrl = 'https://html.duckduckgo.com/html/?q=spiderman+sprite+pixel+art+transparent';
    console.log('Searching:', searchUrl);
    
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await response.text();
    
    // Extract image URLs using regex
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    let match;
    let imgUrls = [];
    while ((match = imgRegex.exec(html)) !== null) {
      if (match[1].startsWith('//')) {
        imgUrls.push('https:' + match[1]);
      } else if (match[1].startsWith('http')) {
        imgUrls.push(match[1]);
      }
    }
    
    if (imgUrls.length === 0) {
      console.log('No images found.');
      return;
    }
    
    // Download the first valid image
    const targetUrl = imgUrls[0];
    console.log('Found image URL:', targetUrl);
    
    const imgRes = await fetch(targetUrl);
    const buffer = await imgRes.arrayBuffer();
    
    fs.writeFileSync('./static/spidey.png', Buffer.from(buffer));
    console.log('Successfully saved to static/spidey.png');
  } catch (err) {
    console.error('Error fetching sprite:', err);
  }
}

fetchSprite();
