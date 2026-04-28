import { NextResponse } from 'next/server';

type ChatRequest = {
  message?: string;
  businessContext?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequest;
    const message = body.message?.trim() || '';

    if (!message) {
      return NextResponse.json({
        type: 'chat',
        message: 'I did not receive a message. Try typing what you need help with.',
      });
    }

    const lower = message.toLowerCase();

    if (
      lower.includes('what can you do') ||
      lower.includes('help') ||
      lower.includes('what do you do')
    ) {
      return NextResponse.json({
        type: 'chat',
        message:
          "I can help you create quotes, draft emails, manage customers, write notes, create reminders, estimate materials, and organize business tasks. For example, you can say: 'Create a quote for John for a deck repair for $2,500.'",
      });
    }

    if (lower.includes('quote') || lower.includes('estimate') || lower.includes('bid')) {
      return NextResponse.json({
        type: 'quote',
        message: 'I started a quote draft for you.',
        data: {
          customerName: extractName(message) || '',
          projectDescription: message,
          notes: 'Draft created from chat request.',
        },
      });
    }

    if (lower.includes('email') || lower.includes('follow up') || lower.includes('follow-up')) {
      return NextResponse.json({
        type: 'email',
        message: 'I started an email draft for you.',
        data: {
          to: '',
          subject: 'Follow up',
          body: `Hi,\n\nI wanted to follow up about: ${message}\n\nThanks,`,
        },
      });
    }

    if (lower.includes('remind') || lower.includes('task')) {
      return NextResponse.json({
        type: 'task',
        message: 'I created a task draft for you.',
        data: {
          title: message,
          status: 'pending',
        },
      });
    }

    return NextResponse.json({
      type: 'chat',
      message:
        "Got it. I can help with quotes, emails, reminders, customers, notes, materials, and business tasks. Tell me what you want me to do.",
    });
  } catch (error) {
    console.error('Chat route error:', error);

    return NextResponse.json(
      {
        type: 'chat',
        message: 'Something went wrong while processing your message.',
      },
      { status: 500 }
    );
  }
}

function extractName(message: string): string | null {
  const match = message.match(/\bfor\s+([A-Z][a-z]+)\b/);
  return match?.[1] || null;
}