import { defineConfig } from "tinacms";

const branch = (
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main"
).trim();

export default defineConfig({
  branch,
  clientId: process.env.TINA_CLIENT_ID || "4cad30f8-6ff4-4a2f-bab1-bcdbc27dcede",
  token: process.env.TINA_TOKEN,

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public",
    },
  },
  schema: {
    collections: [
      {
        name: "page",
        label: "Pages",
        path: "content/pages",
        format: "json",
        fields: [
          {
            type: "string",
            name: "theme",
            label: "Theme",
            options: ["brutalist", "warm"],
            required: true,
          },
          // Header
          {
            type: "object",
            name: "header",
            label: "Header",
            fields: [
              { type: "string", name: "logoAlt", label: "Logo Alt Text" },
              { type: "string", name: "tagline", label: "Tagline", ui: { component: "textarea" } },
            ],
          },
          // Hero Section
          {
            type: "object",
            name: "hero",
            label: "Hero Section",
            fields: [
              { type: "string", name: "heading", label: "Main Heading", ui: { component: "textarea" } },
              {
                type: "object",
                name: "paragraphs",
                label: "Paragraphs",
                list: true,
                fields: [
                  { type: "string", name: "text", label: "Paragraph Text", ui: { component: "textarea" } },
                ],
              },
            ],
          },
          // Background Section
          {
            type: "object",
            name: "background",
            label: "Background Section",
            fields: [
              { type: "string", name: "heading", label: "Section Heading" },
              {
                type: "object",
                name: "introParagraphs",
                label: "Intro Paragraphs",
                list: true,
                fields: [
                  { type: "string", name: "text", label: "Paragraph Text", ui: { component: "textarea" } },
                ],
              },
              {
                type: "object",
                name: "highlights",
                label: "Highlights",
                list: true,
                fields: [
                  { type: "string", name: "text", label: "Highlight Text", ui: { component: "textarea" } },
                ],
              },
              {
                type: "object",
                name: "outroParagraphs",
                label: "Outro Paragraphs",
                list: true,
                fields: [
                  { type: "string", name: "text", label: "Paragraph Text", ui: { component: "textarea" } },
                ],
              },
            ],
          },
          // How I Think Section
          {
            type: "object",
            name: "howIThink",
            label: "How I Think Section",
            fields: [
              { type: "string", name: "heading", label: "Section Heading" },
              {
                type: "object",
                name: "paragraphs",
                label: "Paragraphs",
                list: true,
                fields: [
                  { type: "string", name: "text", label: "Paragraph Text", ui: { component: "textarea" } },
                ],
              },
            ],
          },
          // Things I've Built Section
          {
            type: "object",
            name: "thingsBuilt",
            label: "Things I've Built Section",
            fields: [
              { type: "string", name: "heading", label: "Section Heading" },
              {
                type: "object",
                name: "items",
                label: "Built Items",
                list: true,
                fields: [
                  { type: "string", name: "title", label: "Title" },
                  { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
                ],
              },
            ],
          },
          // Outside Work Section
          {
            type: "object",
            name: "outsideWork",
            label: "Outside Work Section",
            fields: [
              { type: "string", name: "heading", label: "Section Heading" },
              {
                type: "object",
                name: "paragraphs",
                label: "Paragraphs",
                list: true,
                fields: [
                  { type: "string", name: "text", label: "Paragraph Text", ui: { component: "textarea" } },
                ],
              },
            ],
          },
          // What I'm Open To Section
          {
            type: "object",
            name: "openTo",
            label: "What I'm Open To Section",
            fields: [
              { type: "string", name: "heading", label: "Section Heading" },
              { type: "string", name: "intro", label: "Intro Text", ui: { component: "textarea" } },
              {
                type: "object",
                name: "bulletPoints",
                label: "Bullet Points",
                list: true,
                fields: [
                  { type: "string", name: "text", label: "Bullet Point" },
                ],
              },
              { type: "string", name: "goodFit", label: "Good Fit Text", ui: { component: "textarea" } },
              { type: "string", name: "notAFit", label: "Not A Fit Text", ui: { component: "textarea" } },
            ],
          },
          // Contact Section
          {
            type: "object",
            name: "contact",
            label: "Contact Section",
            fields: [
              { type: "string", name: "heading", label: "Section Heading" },
              { type: "string", name: "text", label: "Contact Text", ui: { component: "textarea" } },
              { type: "string", name: "email", label: "Email Address" },
            ],
          },
          // Footer
          {
            type: "object",
            name: "footer",
            label: "Footer",
            fields: [
              { type: "string", name: "copyright", label: "Copyright Text" },
            ],
          },
        ],
      },
    ],
  },
});
