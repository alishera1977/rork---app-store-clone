import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';

const MetalAnalysisSchema = z.object({
  metalName: z.string().describe('Exact metal name from the provided list'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
});

export type MetalAnalysisResult = z.infer<typeof MetalAnalysisSchema>;

export async function analyzeMetalImage(base64Image: string, metalNames: string[]): Promise<MetalAnalysisResult> {
  console.log('[OpenAI] Starting metal image analysis...');
  console.log('[OpenAI] Available metals:', metalNames.length);

  const metalList = metalNames.map((n, i) => `${i + 1}. ${n}`).join('\n');

  const result = await generateObject({
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Ты — эксперт по определению типа металлолома по фотографии.

Определи тип металлолома на фото.
Выбери ТОЛЬКО из этого списка:
${metalList}

Верни название металла точно как в списке и уровень уверенности от 0 до 1.
Если не можешь определить — выбери наиболее подходящий вариант с низкой уверенностью.`,
          },
          {
            type: 'image',
            image: base64Image,
          },
        ],
      },
    ],
    schema: MetalAnalysisSchema,
  });

  console.log('[OpenAI] Analysis result:', JSON.stringify(result));
  return result;
}
