/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn, userEvent, within } from '@storybook/test';
import type { ConversationAttachment } from '@kbn/agent-builder-common/attachments';
import { MAX_PDF_BYTES } from '@kbn/agent-builder-common/attachments';
import { AgentBuilderStorybookProvider } from '../../../__storybook__/agent_builder_storybook_provider';
import { createStorybookAgentBuilderServices } from '../../../__storybook__/agent_builder_services';
import { useConversationContext } from '../../../context/conversation/conversation_context';
import { ConversationInput } from './conversation_input';

const ConversationInputForStorybook: React.FC<React.ComponentProps<typeof ConversationInput>> = (
  props
) => {
  const { resetAttachments } = useConversationContext();
  return (
    <ConversationInput
      {...props}
      onSubmitOverride={(content) => {
        props.onSubmitOverride?.(content);
        resetAttachments?.();
      }}
    />
  );
};

const createColorPngBlob = (color: string): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob as Blob), 'image/png'));
};

const createColorPngFile = async (name: string, color: string): Promise<File> =>
  new File([await createColorPngBlob(color)], name, { type: 'image/png' });

const pasteImage = async (
  canvasElement: HTMLElement,
  { name, color = '#4c6ef5', typeText }: { name: string; color?: string; typeText?: string }
): Promise<HTMLElement> => {
  const canvas = within(canvasElement);
  const editor = await canvas.findByTestId('agentBuilderConversationInputEditor');
  await userEvent.click(editor);
  if (typeText) {
    await userEvent.type(editor, typeText);
  }

  const dt = new DataTransfer();
  dt.items.add(await createColorPngFile(name, color));
  await userEvent.paste(dt);

  return editor;
};

const MINIMAL_PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj
trailer << /Root 1 0 R >>
%%EOF
`;

const createPdfFile = (name: string, sizeBytes?: number): File => {
  const padding =
    sizeBytes && sizeBytes > MINIMAL_PDF.length
      ? [new Uint8Array(sizeBytes - MINIMAL_PDF.length)]
      : [];
  return new File([MINIMAL_PDF, ...padding], name, { type: 'application/pdf' });
};

const pastePdf = async (
  canvasElement: HTMLElement,
  { name, typeText, sizeBytes }: { name: string; typeText?: string; sizeBytes?: number }
): Promise<HTMLElement> => {
  const canvas = within(canvasElement);
  const editor = await canvas.findByTestId('agentBuilderConversationInputEditor');
  await userEvent.click(editor);
  if (typeText) {
    await userEvent.type(editor, typeText);
  }

  const dt = new DataTransfer();
  dt.items.add(createPdfFile(name, sizeBytes));
  await userEvent.paste(dt);

  return editor;
};

const meta: Meta<typeof ConversationInput> = {
  title: 'Conversations/Input/Upload',
  component: ConversationInput,
  args: {
    onSubmitOverride: fn(),
  },
  render: (args) => <ConversationInputForStorybook {...args} />,
  decorators: [
    (Story) => (
      <AgentBuilderStorybookProvider>
        <div style={{ maxWidth: 640, padding: 16 }}>
          <Story />
        </div>
      </AgentBuilderStorybookProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ConversationInput>;

let neverResolvingFileIdCounter = 0;
const neverResolvingFilesClient = {
  create: () =>
    Promise.resolve({ file: { id: `storybook-loading-file-${++neverResolvingFileIdCounter}` } }),
  upload: () => new Promise<void>(() => {}),
  list: () => Promise.resolve({ files: [], total: 0 }),
  get: () => Promise.resolve({ file: null }),
  getDownloadHref: () => '',
  delete: () => Promise.resolve(),
  update: () => Promise.resolve({ file: null }),
  getMetrics: () => Promise.resolve({}),
  publicDownload: () => Promise.resolve(),
} as never;

export const ImageLoading: Story = {
  name: 'Image - Loading',
  decorators: [
    (Story) => (
      <AgentBuilderStorybookProvider services={{ filesClient: neverResolvingFilesClient }}>
        <Story />
      </AgentBuilderStorybookProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    await pasteImage(canvasElement, { name: 'screenshot.png', typeText: 'Check this: ' });
  },
};

export const ImageOne: Story = {
  name: 'Image - 1 Image',
  play: async ({ canvasElement }) => {
    await pasteImage(canvasElement, { name: 'Q3 design brief.png', typeText: 'Check this: ' });
  },
};

const DASHBOARD_ATTACHMENT_TYPE = 'platform.dashboard.dashboard_state';

const attachmentsService = createStorybookAgentBuilderServices().attachmentsService;
if (!attachmentsService.hasAttachmentType(DASHBOARD_ATTACHMENT_TYPE)) {
  attachmentsService.addAttachmentType(DASHBOARD_ATTACHMENT_TYPE, {
    getLabel: (attachment) => (attachment.data as { title?: string }).title ?? 'Dashboard',
    getIcon: () => 'dashboardApp',
  });
}

const createDashboardAttachment = (
  title: string,
  id = 'story-dashboard-1'
): ConversationAttachment => ({
  id,
  type: DASHBOARD_ATTACHMENT_TYPE,
  data: { title, panels: [] },
});

export const ImageWithDashboard: Story = {
  name: 'Image - Dashboard + Image',
  decorators: [
    (Story) => (
      <AgentBuilderStorybookProvider
        initialAttachments={[createDashboardAttachment('[Flights] Global Flight Dashboard')]}
      >
        <Story />
      </AgentBuilderStorybookProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    await pasteImage(canvasElement, { name: 'open.png' });
  },
};

export const ImageDuplicateFilename: Story = {
  name: 'Image - Duplicate Filename',
  play: async ({ canvasElement }) => {
    await pasteImage(canvasElement, { name: 'duplicate.png', color: '#e63946' });
    await pasteImage(canvasElement, { name: 'duplicate.png', color: '#2a9d8f' });
  },
};

const WEIRD_FILENAMES_WITH_COLORS = [
  [
    'this-is-an-extremely-long-filename-that-someone-might-actually-have-on-their-computer-because-they-never-clean-up-their-downloads-folder-screenshot-2026-final-v3-FINAL-actually-final.png',
    '#e63946',
  ],
  ["50% () — v2 [] & #3 'quoted' @user.png", '#2a9d8f'],
  ['   ScReEnShOt   With   Extra   Spaces   .PNG', '#e9c46a'],
  ['a', '#aaaccc'],
] as const;

export const ImageMultipleWithTrickyFilenames: Story = {
  name: 'Image - Multiple Images (Tricky Filenames)',
  play: async ({ canvasElement }) => {
    const [[firstName, firstColor], ...rest] = WEIRD_FILENAMES_WITH_COLORS;
    await pasteImage(canvasElement, {
      name: firstName,
      color: firstColor,
      typeText: 'Check these: ',
    });
    for (const [name, color] of rest) {
      await pasteImage(canvasElement, { name, color });
    }
  },
};

// TODO(pdf upload step 9): provide `pdfFilesClient: neverResolvingFilesClient` and a never-resolving `attachmentsService.create` mock so the pill keeps the spinner.
export const PdfLoading: Story = {
  name: 'PDF - Loading',
  play: async ({ canvasElement }) => {
    await pastePdf(canvasElement, { name: 'invoice.pdf' });
  },
};

// TODO(pdf upload step 9): provide a resolving `pdfFilesClient` and an `attachmentsService.create` mock that returns a pdf attachment.
export const PdfOne: Story = {
  name: 'PDF - 1 PDF',
  play: async ({ canvasElement }) => {
    await pastePdf(canvasElement, { name: 'invoice.pdf', typeText: 'Summarize this: ' });
  },
};

// TODO(pdf upload step 9): provide a resolving `pdfFilesClient` and an `attachmentsService.create` mock that returns a pdf attachment.
export const PdfWithImage: Story = {
  name: 'PDF - Image + PDF',
  play: async ({ canvasElement }) => {
    await pasteImage(canvasElement, { name: 'chart.png' });
    await pastePdf(canvasElement, { name: 'invoice.pdf' });
  },
};

// TODO(pdf upload step 9): provide a resolving `pdfFilesClient` and an `attachmentsService.create` mock; the second paste should show a toast.
export const PdfSecondRefused: Story = {
  name: 'PDF - Second PDF refused',
  play: async ({ canvasElement }) => {
    await pastePdf(canvasElement, { name: 'invoice.pdf' });
    await pastePdf(canvasElement, { name: 'contract.pdf' });
  },
};

// TODO(pdf upload step 9): mock the PDF availability hook to return `true`; the size check runs before upload, so the paste should show a toast.
export const PdfTooLarge: Story = {
  name: 'PDF - Too large',
  play: async ({ canvasElement }) => {
    await pastePdf(canvasElement, { name: 'huge.pdf', sizeBytes: MAX_PDF_BYTES + 1 });
  },
};

// TODO(pdf upload step 9): provide a resolving `pdfFilesClient` and an `attachmentsService.create` mock that rejects with "Could not read the PDF. Try again later.".
export const PdfServerError: Story = {
  name: 'PDF - Server error',
  play: async ({ canvasElement }) => {
    await pastePdf(canvasElement, { name: 'invoice.pdf' });
  },
};

// TODO(pdf upload step 9): mock the PDF availability hook to return `false` so the paste does nothing.
export const PdfNotAvailable: Story = {
  name: 'PDF - Not available',
  play: async ({ canvasElement }) => {
    await pastePdf(canvasElement, { name: 'invoice.pdf' });
  },
};
