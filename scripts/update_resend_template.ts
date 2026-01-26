
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const API_KEY = process.env.RESEND_API_KEY;

if (!API_KEY) {
  console.error('Error: RESEND_API_KEY is not defined in .env');
  process.exit(1);
}

// Map filenames to subjects and variables
const TEMPLATE_CONFIG: Record<string, { subject: string; variables: { key: string; type: string; fallback_value?: any }[] }> = {
  'welcome-completed': {
    subject: "Welcome to DadCircles!",
    variables: [{ key: "location", type: "string", fallback_value: "your area" }]
  },
  'welcome-abandoned': {
      subject: "Complete your DadCircles profile",
      variables: [
        { key: "location", type: "string", fallback_value: "your area" },
        { key: "magic_link", type: "string" }
      ]
  },
  'resume-session': {
      subject: "Resume your DadCircles session",
      variables: [{ key: "magic_link", type: "string" }]
  },
   'group-intro': {
      subject: "You've been matched! Meet your Dad Circle",
       variables: [
        { key: "group_name", type: "string" },
        { key: "members_list", type: "string" }
      ]
  },
  'followup-3day': {
      subject: "Checking in from DadCircles",
      variables: [{ key: "location", type: "string", fallback_value: "your area" }]
  },
   'signup-other': {
      subject: "Welcome to DadCircles",
      variables: [{ key: "location", type: "string", fallback_value: "your area" }]
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function request(method: string, path: string, body?: any) {
  const url = `https://api.resend.com/${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (response.status === 204) return null;

  if (!response.ok) {
    const errorText = await response.text();
    // Allow 404 for delete/get if we handle it
    if (response.status !== 404) {
        throw new Error(`API Error (${method} ${path}): ${response.status} ${response.statusText} - ${errorText}`);
    }
    return { error: true, status: 404 };
  }

  return response.json();
}

async function main() {
  try {
    // 1. Parse Arguments
    const args = process.argv.slice(2);
    if (args.length !== 1) {
      console.error('Usage: npx tsx scripts/update_resend_template.ts <filename>');
      console.error('Example: npx tsx scripts/update_resend_template.ts welcome-completed.html');
      process.exit(1);
    }

    const filename = args[0];
    const templateName = path.basename(filename, '.html');
    const templatePath = path.resolve(process.cwd(), 'email-templates', filename);

    if (!fs.existsSync(templatePath)) {
      console.error(`Error: File not found at ${templatePath}`);
      process.exit(1);
    }

    console.log(`Processing template '${templateName}' from ${filename}...`);
    
    // Get config or default
    const config = TEMPLATE_CONFIG[templateName] || { 
      subject: "Notification from DadCircles", 
      variables: [] 
    };

    const htmlContent = fs.readFileSync(templatePath, 'utf-8');

    // 2. Check Existence
    console.log(`1. Checking if template '${templateName}' exists...`);
    // Note: Listing all templates is safer than assuming ID knowledge, but slower. 
    // We'll list and search by name.
    const templatesList = await request('GET', 'templates');
    const existingTemplate = templatesList.data?.find((t: any) => t.name === templateName);

    if (existingTemplate) {
        console.log(`   Found existing template: ${existingTemplate.id}`);
        console.log(`2. Deleting template ${existingTemplate.id}...`);
        await request('DELETE', `templates/${existingTemplate.id}`);
        console.log('   Template deleted.');
        console.log('   Waiting 1 second...');
        await sleep(1000);
    } else {
        console.log(`   Template '${templateName}' does not exist. Proceeding to create.`);
    }

    // 3. Create
    console.log(`3. Creating new template '${templateName}'...`);
    const createPayload = {
      name: templateName,
      html: htmlContent,
      subject: config.subject,
      variables: config.variables
    };

    const newTemplate = await request('POST', 'templates', createPayload);
    if (newTemplate.error) throw new Error("Failed to create template");
    
    console.log(`   Template created. ID: ${newTemplate.id}`);
    console.log('   Waiting 1 second...');
    await sleep(1000);

    // 4. Publish
    console.log(`4. Publishing template ${newTemplate.id}...`);
    try {
        await request('POST', `templates/${newTemplate.id}/publish`);
        console.log('   Template published.');
    } catch (error: any) {
        console.warn('   Warning: Publish step failed or is unnecessary.', error.message);
    }

    console.log('   Waiting 1 second...');
    await sleep(1000);

    // 5. Verify
    console.log(`5. Verifying template ${newTemplate.id}...`);
    const verifiedTemplate = await request('GET', `templates/${newTemplate.id}`);
    
    if (verifiedTemplate && !verifiedTemplate.error) {
        const createdAt = new Date(verifiedTemplate.created_at);
        const now = new Date();
        const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;

        console.log(`   Created at: ${verifiedTemplate.created_at}`);
        console.log(`   Age: ${diffSeconds.toFixed(1)} seconds`);
        console.log('SUCCESS: Template sync complete.');
    } else {
        console.error('ERROR: Could not verify created template.');
    }

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
