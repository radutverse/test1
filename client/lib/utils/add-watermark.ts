/**
 * Add watermark text to an image using Canvas API
 * @param imageUrl - Data URL or blob URL of the image
 * @param watermarkText - Text to watermark (default: "protected:")
 * @returns Promise<string> - Data URL of watermarked image
 */
export async function addCanvasWatermark(
  imageUrl: string,
  watermarkText: string = "protected:",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);

      // Draw a large lock emoji in the center
      const fontSize = Math.max(200, Math.floor(img.width / 3));
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 4;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const centerX = img.width / 2;
      const centerY = img.height / 2;

      ctx.strokeText("🔒", centerX, centerY);
      ctx.fillText("🔒", centerX, centerY);

      // Convert canvas to data URL (permanent, can be saved to database)
      // instead of blob URL (temporary, tied to browser session)
      try {
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (error) {
        reject(new Error("Failed to convert canvas to data URL"));
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image for watermarking"));
    };

    img.crossOrigin = "anonymous";
    img.src = imageUrl;
  });
}
