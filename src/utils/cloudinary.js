import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a local file to Cloudinary and deletes it afterwards.
 * @param {string} localFilePath - Path of the file saved temporarily on server.
 * @returns {object|null} - Cloudinary response object or null if failed.
 */
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Upload to cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto", // auto-detects file type (image, video, etc.)
    });

    // Remove file from local server after successful upload
    try {
      fs.unlinkSync(localFilePath);
      return response;
    } catch (err) {
      console.error("Failed to delete local file:", err.message);
    }

    return response;
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);

    // Remove local file if upload failed
    try {
      fs.unlinkSync(localFilePath);
    } catch (err) {
      console.error("Failed to delete local file after error:", err.message);
    }

    return null;
  }
};

export { uploadOnCloudinary };
