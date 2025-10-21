import { GoogleGenAI, Modality, Content } from "@google/genai";
import { ImageData, AspectRatio, GenerationStyle, Message, Role } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const editModel = 'gemini-2.5-flash-image';
const generationModelWithMemory = 'gemini-2.5-flash-image';

// Maps our internal message Role to the one Gemini API expects
const mapRoleForGemini = (role: Role): 'user' | 'model' => {
    switch (role) {
        case Role.USER:
            return 'user';
        case Role.MODEL:
            return 'model';
        // Default case for safety, though we filter for only USER and MODEL roles
        default:
            return 'user';
    }
};


export const generateImage = async (
    prompt: string,
    aspectRatio: AspectRatio,
    style: GenerationStyle,
    negativePrompt: string,
    history: Message[]
): Promise<ImageData> => {
    try {
        let finalPrompt = prompt;

        // Since gemini-2.5-flash-image doesn't have dedicated params, we bake them into the prompt.
        if (style !== 'Default') {
            const stylePrefix = {
                'Photorealistic': 'A photorealistic image of',
                'Anime': 'An anime style image of',
                'Illustration': 'An illustration of',
                'Aquarela': 'A watercolor painting of',
                'Cyberpunk': 'A cyberpunk style image of',
                'Fantasia': 'A fantasy style image of',
                'Pixel Art': 'Pixel art of',
                'Minimalista': 'A minimalist line art drawing of',
                'Modelo 3D': 'A 3D model render of',
                'Isométrico': 'An isometric style image of',
                'Arte Abstrata': 'An abstract painting representing',
                'Arte Vintage': 'A vintage photograph of',
                'Arte Noir': 'A film noir style image of'
            };
            finalPrompt = `${stylePrefix[style as keyof typeof stylePrefix]} ${prompt}`;
        }
        
        // Add other parameters to the prompt for the model to consider
        finalPrompt += `\n\n- Desired aspect ratio: ${aspectRatio}`;
        if (negativePrompt.trim()) {
            finalPrompt += `\n- Negative prompt (what to avoid): ${negativePrompt.trim()}`;
        }
        
        // Convert our message history into the format Gemini expects.
        // We only include text-based user/model messages to build context.
        const contents: Content[] = history
            .filter(msg => (msg.role === Role.USER || msg.role === Role.MODEL) && msg.text && msg.id !== 'initial')
            .map(msg => ({
                role: mapRoleForGemini(msg.role),
                parts: [{ text: msg.text! }]
            }));
        
        // Add the current user prompt to the history
        contents.push({ role: 'user', parts: [{ text: finalPrompt }] });

        const response = await ai.models.generateContent({
            model: generationModelWithMemory,
            contents: contents, // Pass the full conversation history
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return {
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data,
                };
            }
        }
        
        const finishReason = response.candidates?.[0]?.finishReason;
        const responseText = response.text;
        
        let errorMessage = "The AI did not return an image. This might be due to a safety filter or an issue with the prompt. Please try rephrasing.";
        if (finishReason && finishReason !== 'STOP') {
            errorMessage = `Image generation failed with reason: ${finishReason}.`;
        }
        if (responseText && responseText.trim()) {
            errorMessage += ` The model responded with: "${responseText.trim()}"`;
        }
        
        throw new Error(errorMessage);

    } catch (error) {
        console.error("Error generating image:", error);

        // Check for the specific structure of a Google API error
        if (error && typeof error === 'object' && 'error' in error) {
            const apiError = (error as any).error;
            if (apiError && typeof apiError === 'object' && 'message' in apiError) {
                // The API message is user-friendly, so we can use it directly.
                throw new Error(apiError.message);
            }
        }

        // Check if it's a standard Error instance
        if (error instanceof Error) {
            // Rethrow the original error message
            throw new Error(error.message);
        }
        
        // Fallback for other types of errors
        throw new Error("Failed to generate image due to an unexpected error. Please try again.");
    }
};

export const editImage = async (prompt: string, image: ImageData, mask?: ImageData): Promise<ImageData> => {
    try {
        const parts = [
            {
                inlineData: {
                    data: image.data,
                    mimeType: image.mimeType,
                },
            },
            { text: prompt },
        ];

        if (mask) {
             parts.push({
                inlineData: {
                    data: mask.data,
                    mimeType: mask.mimeType,
                }
            });
        }

        const response = await ai.models.generateContent({
            model: editModel,
            contents: {
                parts: parts,
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return {
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data,
                };
            }
        }
        
        // If no image is found, construct a more detailed error message.
        const finishReason = response.candidates?.[0]?.finishReason;
        const responseText = response.text;
        
        let errorMessage = "No edited image data found in the response.";
        if (finishReason && finishReason !== 'STOP') {
            errorMessage = `Image generation failed with reason: ${finishReason}.`;
        }
        if (responseText && responseText.trim()) {
            errorMessage += ` The model responded with: "${responseText.trim()}"`;
        }
        
        throw new Error(errorMessage);

    } catch (error) {
        console.error("Error editing image:", error);
        
        // Check for the specific structure of a Google API error
        if (error && typeof error === 'object' && 'error' in error) {
            const apiError = (error as any).error;
            if (apiError && typeof apiError === 'object' && 'message' in apiError) {
                throw new Error(apiError.message);
            }
        }

        // Check if it's a standard Error instance
        if (error instanceof Error) {
           throw new Error(error.message);
        }
        throw new Error("Failed to edit image. An unknown error occurred.");
    }
};

const ENHANCE_PROMPT = "Enhance this image, improving quality, details, and clarity. Make it sharper and more vibrant without altering the main subject.";

export const enhanceImage = async (image: ImageData): Promise<ImageData> => {
    try {
        // We reuse the editImage function with a specific enhancement prompt.
        return await editImage(ENHANCE_PROMPT, image);
    } catch (error) {
        console.error("Error enhancing image:", error);
        if (error instanceof Error) {
           // Add context to the error message from editImage
           throw new Error(`Enhancement failed: ${error.message}`);
        }
        // Fallback, though editImage should always throw an Error instance now.
        throw new Error("Failed to enhance image due to an unexpected error.");
    }
};

const REMOVE_BACKGROUND_PROMPT = "Remove the background of this image, making it transparent. The main subject should be preserved perfectly. The output must be a PNG with a transparent background.";

export const removeBackground = async (image: ImageData): Promise<ImageData> => {
    try {
        // We reuse the editImage function with a specific prompt.
        return await editImage(REMOVE_BACKGROUND_PROMPT, image);
    } catch (error) {
        console.error("Error removing background:", error);
        if (error instanceof Error) {
           // Add context to the error message from editImage
           throw new Error(`Background removal failed: ${error.message}`);
        }
        // Fallback
        throw new Error("Failed to remove image background due to an unexpected error.");
    }
};
