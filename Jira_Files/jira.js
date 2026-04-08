

async function getJiraStory(issueKey) {
  const email = "ajayveer.v@idsil.com";
 const apiToken = process.env.apiToken;

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