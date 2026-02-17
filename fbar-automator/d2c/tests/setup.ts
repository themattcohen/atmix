import dotenv from "dotenv";
import path from "path";

// Load the .env file for test environment
dotenv.config({ path: path.resolve(__dirname, "../.env") });
