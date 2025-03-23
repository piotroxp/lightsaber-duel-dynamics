import { TextureLoader, Texture, RepeatWrapping, SRGBColorSpace } from 'three';

// Fallback texture data - a 1x1 white pixel
const fallbackTextureData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export const loadTextureWithFallback = async (path: string): Promise<Texture> => {
  return new Promise((resolve, reject) => {
    const loader = new TextureLoader();
    
    // Try to load the requested texture
    loader.load(
      path,
      (texture) => {
        // Success: set texture parameters and resolve
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(1, 1);
        // Use colorSpace instead of encoding for newer Three.js
        texture.colorSpace = SRGBColorSpace;
        resolve(texture);
      },
      // Progress callback
      undefined,
      // Error callback
      (error) => {
        console.warn(`Failed to load texture ${path}, using fallback`, error);
        
        // Load fallback texture
        loader.load(
          fallbackTextureData,
          (fallbackTexture) => {
            fallbackTexture.wrapS = RepeatWrapping;
            fallbackTexture.wrapT = RepeatWrapping;
            fallbackTexture.repeat.set(10, 10);
            fallbackTexture.colorSpace = SRGBColorSpace;
            resolve(fallbackTexture);
          },
          undefined,
          (fallbackError) => {
            // If even the fallback fails, create an empty texture
            console.error("Failed to load fallback texture", fallbackError);
            const emptyTexture = new Texture();
            resolve(emptyTexture);
          }
        );
      }
    );
  });
};
