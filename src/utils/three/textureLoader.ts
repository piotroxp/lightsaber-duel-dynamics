import { TextureLoader, SRGBColorSpace, RepeatWrapping, CanvasTexture } from 'three';

// Reliable texture loader with fallback
export const loadTextureWithFallback = (path: string): Promise<THREE.Texture> => {
  return new Promise((resolve) => {
    const loader = new TextureLoader();
    
    loader.load(
      path,
      (texture) => {
        // Success callback
        texture.encoding = SRGBColorSpace;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(10, 10);
        resolve(texture);
      },
      undefined,
      () => {
        // Error callback - create a fallback texture
        console.warn(`Failed to load texture: ${path}, using fallback`);
        
        // Create a simple canvas-based fallback texture
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Create a checkerboard pattern
          const squareSize = 16;
          for (let y = 0; y < canvas.height; y += squareSize) {
            for (let x = 0; x < canvas.width; x += squareSize) {
              ctx.fillStyle = (x + y) % (squareSize * 2) === 0 ? '#444' : '#666';
              ctx.fillRect(x, y, squareSize, squareSize);
            }
          }
        }
        
        const fallbackTexture = new CanvasTexture(canvas);
        fallbackTexture.wrapS = RepeatWrapping;
        fallbackTexture.wrapT = RepeatWrapping;
        fallbackTexture.repeat.set(10, 10);
        resolve(fallbackTexture);
      }
    );
  });
}; 