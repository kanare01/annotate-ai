import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const autoAnnotate = async (imageBase64: string) => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64.split(',')[1] || imageBase64
            }
          },
          {
            text: "Detect all major objects in this image and provide precise bounding boxes. For each object, identify its common name (e.g., 'car', 'person', 'tree'). Return a JSON array of objects with 'label' and 'box_2d' [ymin, xmin, ymax, xmax] normalized to 1000. Be as accurate as possible with the coordinates."
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            box_2d: { 
              type: Type.ARRAY, 
              items: { type: Type.NUMBER },
              description: "[ymin, xmin, ymax, xmax] normalized to 1000"
            }
          },
          required: ["label", "box_2d"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
};
