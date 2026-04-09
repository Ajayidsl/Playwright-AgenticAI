
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../env/.env.prod') });

function normalizeEnvValue(value) {
  if (!value) {
    return value;
  }

  return value.trim().replace(/^[\s"']+|[\s"',;]+$/g, '');
}

function adfToText(node) {
  if (!node) {
    return '';
  }

  if (typeof node === 'string') {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(adfToText).join('');
  }

  if (node.type === 'text') {
    return node.text || '';
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (!node.content) {
    return '';
  }

  const text = node.content.map(adfToText).join('');

  if (node.type === 'paragraph') {
    return `${text}\n`;
  }

  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return `${text}\n`;
  }

  if (node.type === 'listItem') {
    return `- ${text}`;
  }

  return text;
}

function pickUser(user) {
  if (!user) {
    return null;
  }

  return {
    accountId: user.accountId || null,
    displayName: user.displayName || null,
    emailAddress: user.emailAddress || null,
    active: typeof user.active === 'boolean' ? user.active : null
  };
}

function pickSimpleItems(items, key = 'name') {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    id: item.id || null,
    [key]: item[key] || null
  }));
}

function pickIssueLinks(issueLinks) {
  if (!Array.isArray(issueLinks)) {
    return [];
  }

  return issueLinks.map((link) => ({
    type: link.type?.name || null,
    inward: link.inwardIssue
      ? {
          key: link.inwardIssue.key || null,
          summary: link.inwardIssue.fields?.summary || null,
          status: link.inwardIssue.fields?.status?.name || null
        }
      : null,
    outward: link.outwardIssue
      ? {
          key: link.outwardIssue.key || null,
          summary: link.outwardIssue.fields?.summary || null,
          status: link.outwardIssue.fields?.status?.name || null
        }
      : null
  }));
}

function pickComments(commentField) {
  const comments = commentField?.comments;

  if (!Array.isArray(comments)) {
    return [];
  }

  return comments.map((comment) => ({
    id: comment.id || null,
    author: pickUser(comment.author),
    created: comment.created || null,
    updated: comment.updated || null,
    body: comment.body || null,
    bodyText: adfToText(comment.body).trim() || null
  }));
}

async function getJiraStory(issueKey) {
  const email = "ajayveer.v@idsil.com";
  const apiToken = normalizeEnvValue(process.env.apiToken);
  const domain = normalizeEnvValue(process.env.domain);

  if (!apiToken || !domain) {
    throw new Error("Missing Jira configuration: apiToken or domain is not set correctly");
  }

  const fields = [
    'summary',
    'description',
    'status',
    'priority',
    'issuetype',
    'assignee',
    'reporter',
    'labels',
    'components',
    'fixVersions',
    'attachment',
    'comment',
    'created',
    'updated',
    'duedate',
    'parent',
    'subtasks',
    'issuelinks'
  ].join(',');
  const url = `https://${domain}/rest/api/3/issue/${issueKey}?fields=${fields}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jira API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const { fields: issueFields } = data;

  return {
    issueKey: data.key,
    title: issueFields.summary || null,
    description: issueFields.description || null,
    descriptionText: adfToText(issueFields.description).trim() || null,
    issueType: issueFields.issuetype?.name || null,
    status: issueFields.status?.name || null,
    priority: issueFields.priority?.name || null,
    assignee: pickUser(issueFields.assignee),
    reporter: pickUser(issueFields.reporter),
    labels: Array.isArray(issueFields.labels) ? issueFields.labels : [],
    components: pickSimpleItems(issueFields.components),
    fixVersions: pickSimpleItems(issueFields.fixVersions),
    attachments: Array.isArray(issueFields.attachment)
      ? issueFields.attachment.map((attachment) => ({
          id: attachment.id || null,
          filename: attachment.filename || null,
          mimeType: attachment.mimeType || null,
          size: attachment.size || null,
          content: attachment.content || null
        }))
      : [],
    comments: pickComments(issueFields.comment),
    created: issueFields.created || null,
    updated: issueFields.updated || null,
    dueDate: issueFields.duedate || null,
    parent: issueFields.parent
      ? {
          key: issueFields.parent.key || null,
          summary: issueFields.parent.fields?.summary || null,
          issueType: issueFields.parent.fields?.issuetype?.name || null
        }
      : null,
    subtasks: Array.isArray(issueFields.subtasks)
      ? issueFields.subtasks.map((subtask) => ({
          key: subtask.key || null,
          summary: subtask.fields?.summary || null,
          status: subtask.fields?.status?.name || null,
          issueType: subtask.fields?.issuetype?.name || null
        }))
      : [],
    issueLinks: pickIssueLinks(issueFields.issuelinks)
  };
}

module.exports = { getJiraStory };
