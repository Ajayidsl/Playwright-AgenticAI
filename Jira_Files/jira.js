
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../env/.env.prod') });

function normalizeEnvValue(value) {
  if (!value) {
    return value;
  }

  return value.trim().replace(/^[\s"']+|[\s"',;]+$/g, '');
}

async function getJiraStory(issueKey) {
  const email = "ajayveer.v@idsil.com";
  const apiToken = normalizeEnvValue(process.env.apiToken);
  const domain = normalizeEnvValue(process.env.domain);

  if (!apiToken || !domain) {
    throw new Error("Missing Jira configuration: apiToken or domain is not set correctly");
  }

  const url = `https://${domain}/rest/api/3/issue/${issueKey}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`,
      "Accept": "application/json"
    }
  });

  const data = await response.json();

  return {
    title: data.fields.summary,
    description: data.fields.description
  };
}

module.exports = { getJiraStory };
