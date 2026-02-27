import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// We can't use @notionhq/client in edge runtime easily if it uses node modules not supported.
// But standard Next.js API routes run in Node.js environment by default.
// I need to install @notionhq/client.

export async function POST(req: NextRequest) {
  const token = req.headers.get('Notion-Token');
  const databaseId = req.headers.get('Notion-Database-Id');

  if (!token || !databaseId) {
    return NextResponse.json({ message: 'Missing credentials' }, { status: 401 });
  }

  const notion = new Client({ auth: token });
  const body = await req.json();
  const { action, task, lastSyncAt } = body;

  try {
    if (action === 'push_task') {
      // Check if exists
      if (task.notion_id) {
        // Update
        await notion.pages.update({
          page_id: task.notion_id,
          properties: {
            Name: {
              title: [{ text: { content: task.title } }],
            },
            Status: {
              status: { name: task.status === 'done' ? 'Done' : 'Not started' }, // Adjust based on user's DB schema
            },
          },
        });
        return NextResponse.json({ notion_id: task.notion_id });
      } else {
        // Create
        const response = await notion.pages.create({
          parent: { database_id: databaseId },
          properties: {
            Name: {
              title: [{ text: { content: task.title } }],
            },
            Status: {
              status: { name: task.status === 'done' ? 'Done' : 'Not started' },
            },
          },
        });
        return NextResponse.json({ notion_id: response.id });
      }
    } else if (action === 'pull_tasks') {
        // Query database
        const response = await (notion.databases as any).query({
            database_id: databaseId,
            filter: lastSyncAt ? {
                timestamp: 'last_edited_time',
                last_edited_time: {
                    after: new Date(lastSyncAt).toISOString()
                }
            } : undefined,
        });
        return NextResponse.json({ tasks: response.results });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Notion API error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
