const fs = require('fs');
const path = require('path');
const { getJiraStory } = require('./jira');

(async () => {
  const issueKey = "AG-2";

  try {
    const story = await getJiraStory(issueKey);

    console.log("TITLE:", story.title);
    console.log("DESCRIPTION:", story.description);

    const folderPath = path.join(__dirname, '../Jira_Stories');

    const filePath = path.join(folderPath, `${issueKey}.json`);

    const storyData = {
      issueKey,
      title: story.title,
      description: story.description,
      fetchedAt: new Date().toISOString()
    };

    fs.writeFileSync(filePath, JSON.stringify(storyData, null, 2));

    console.log(`Story saved to: ${filePath}`);

  } catch (error) {
    console.error("Error fetching Jira story:", error.message);
  }
})();