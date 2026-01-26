
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const API_KEY = process.env.RESEND_API_KEY;

if (!API_KEY) {
  console.error('Error: RESEND_API_KEY is not defined in .env');
  process.exit(1);
}

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
    if (response.status !== 404) {
        throw new Error(`API Error (${method} ${path}): ${response.status} ${response.statusText} - ${errorText}`);
    }
    return { error: true, status: 404 };
  }

  return response.json();
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function pullTemplate(templateName: string) {
  const filename = `${templateName}.html`;
  const templatePath = path.resolve(process.cwd(), 'email-templates', filename);

  console.log(`\nProcessing '${templateName}'...`);

  // 1. Find the template by name
  console.log(`1. Searching for template '${templateName}'...`);
  const templatesList = await request('GET', 'templates');
  const existingTemplate = templatesList.data?.find((t: any) => t.name === templateName);

  if (!existingTemplate) {
    console.error(`Error: Template '${templateName}' not found on Resend.`);
    return false;
  }
  console.log(`   Found template: ${existingTemplate.id}`);

  // 2. Fetch the full template data to get the HTML content
  console.log(`2. Fetching content for template ${existingTemplate.id}...`);
  const templateData = await request('GET', `templates/${existingTemplate.id}`);

  if (!templateData || !templateData.html) {
      console.error('Error: Could not fetch template HTML content.');
      return false;
  }

  // 3. Write the HTML content to the local file
  console.log(`3. Writing content to ${templatePath}...`);
  fs.writeFileSync(templatePath, templateData.html, 'utf-8');

  console.log(`SUCCESS: Template '${templateName}' has been pulled and saved to ${filename}.`);
  return true;
}


async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length > 1) {
      console.error('Usage: npx tsx scripts/pull_resend_template.ts [template_name]');
      console.error('Example (single): npx tsx scripts/pull_resend_template.ts welcome-completed');
      console.error('Example (all): npx tsx scripts/pull_resend_template.ts');
      process.exit(1);
    }

    if (args.length === 1) {
      // Pull a single template
      const templateName = args[0].replace('.html', '');
      await pullTemplate(templateName);
    } else {
      // Pull all templates
      console.log('No template specified. Pulling all templates from email-templates directory...');
      const templateDir = path.resolve(process.cwd(), 'email-templates');
      const files = fs.readdirSync(templateDir)
        .filter(file => file.endsWith('.html') && file !== 'blank.html');
      
      let successCount = 0;
      let failCount = 0;

      for (const file of files) {
        const templateName = path.basename(file, '.html');
        const success = await pullTemplate(templateName);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        await sleep(1000); // Wait 1 second before next request
      }
      
      console.log(`\n--- ALL DONE ---`);
      console.log(`Successfully pulled: ${successCount}`);
      console.log(`Failed: ${failCount}`);
      if(failCount > 0) {
          process.exit(1)
      }
    }

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
