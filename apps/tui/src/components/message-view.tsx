import { type DisplayMessage, ROLE_COLOR, ROLE_LABEL } from '@totvibe/view';

type MessageViewProps = {
  message: DisplayMessage;
};

export const MessageView = ({ message }: MessageViewProps) => (
  <box style={{ flexDirection: 'column' }}>
    <text fg={ROLE_COLOR[message.role]}>{ROLE_LABEL[message.role]}</text>
    <text>{message.text}</text>
  </box>
);
