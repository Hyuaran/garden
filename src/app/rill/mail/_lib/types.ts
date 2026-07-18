export type RillMailBox = {
  id: string;
  address: string;
  label: string;
  kind: "personal" | "shared";
};

export type RillMailMessage = {
  id: string;
  box: RillMailBox;
  subject: string;
  fromName: string;
  fromAddress: string;
  to: string[];
  receivedDateTime: string;
  hasAttachments: boolean;
  isRead: boolean;
  categories: string[];
  bodyPreview: string;
};

export type RillMailAttachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
};

export type RillMailDetail = RillMailMessage & {
  body: { contentType: "html" | "text"; content: string };
  attachments: RillMailAttachment[];
};

export type RillMessagesResponse = {
  messages: RillMailMessage[];
  cursor: string | null;
  boxIds?: string[];
};
