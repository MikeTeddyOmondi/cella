import type { CustomBlockNoteSchema } from './types';

export const focusEditor = (editor: CustomBlockNoteSchema) => {
  const lastBlock = editor.document[editor.document.length - 1];
  editor.focus();
  editor.setTextCursorPosition(lastBlock.id, 'end');
};

export const handleSubmitOnEnter = (editor: CustomBlockNoteSchema): CustomBlockNoteSchema['document'] | null => {
  const blocks = editor.document;
  // Get the last block and modify its content so we remove last \n
  const lastBlock = blocks[blocks.length - 1];
  if (Array.isArray(lastBlock.content)) {
    const lastBlockContent = lastBlock.content as { text: string }[];
    if (lastBlockContent.length > 0) lastBlockContent[0].text = lastBlockContent[0].text.replace(/\n$/, ''); // Remove the last newline character
    const updatedLastBlock = { ...lastBlock, content: lastBlockContent };
    return [...blocks.slice(0, -1), updatedLastBlock] as CustomBlockNoteSchema['document'];
  }
  return null;
};
