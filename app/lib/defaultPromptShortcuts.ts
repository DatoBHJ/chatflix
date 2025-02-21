interface DefaultPromptShortcut {
  name: string;
  content: string;
}

export const defaultPromptShortcuts: DefaultPromptShortcut[] = [
  {
    name: 'summarize',
    content: 'Please provide a clear and concise summary of the following text, highlighting the key points and main ideas: ',
  },
  {
    name: 'explain',
    content: 'Please explain this concept in simple terms, as if you\'re teaching it to someone who is new to the subject: ',
  },
  {
    name: 'translate_to_english',
    content: 'Please translate the following text to english: ',
  },
];