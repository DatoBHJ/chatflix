// import { useMemo } from "react";


// const HomeContent = () => {
//     const [query] = useQueryState('query', parseAsString.withDefault(''))
//     const [q] = useQueryState('q', parseAsString.withDefault(''))
//     const [model] = useQueryState('model', parseAsString.withDefault('scira-default'))

//     const initialState = useMemo(() => ({
//         query: query || q,
//         model: model
//     }), [query, q, model]);

//     const lastSubmittedQueryRef = useRef(initialState.query);
//     const [selectedModel, setSelectedModel] = useState(initialState.model);
//     const [selectedGroup, setSelectedGroup] = useState<SearchGroupId>('web');

//     // Get stored user ID
//     const userId = useMemo(() => getUserId(), []);

//     const chatOptions: UseChatOptions = useMemo(() => ({
//         api: '/api/route',
//         experimental_throttle: 500,
//         body: {
//             model: selectedModel,
//             group: selectedGroup,
//             user_id: userId,
//         },
//         onFinish: async (message, { finishReason }) => {
//             console.log("[finish reason]:", finishReason);
//             if (message.content && (finishReason === 'stop' || finishReason === 'length')) {
//                 const newHistory = [
//                     { role: "user", content: lastSubmittedQueryRef.current },
//                     { role: "assistant", content: message.content },
//                 ];
//                 const { questions } = await suggestQuestions(newHistory);
//                 setSuggestedQuestions(questions);
//             }
//         },
//         onError: (error) => {
//             console.error("Chat error:", error.cause, error.message);
//             toast.error("An error occurred.", {
//                 description: `Oops! An error occurred while processing your request. ${error.message}`,
//             });
//         },
//     }), [selectedModel, selectedGroup, userId]);

//     const {
//         input,
//         messages,
//         setInput,
//         append,
//         handleSubmit,
//         setMessages,
//         reload,
//         stop,
//         status,
//     } = useChat(chatOptions);

//     const isValidUrl = (str: string) => {
//         try {
//             new URL(str);
//             return true;
//         } catch {
//             return false;
//         }
//     };

//     import { ToolInvocation } from 'ai';
//     import { ReasoningUIPart, ToolInvocationUIPart, TextUIPart, SourceUIPart } from '@ai-sdk/ui-utils';

//     /// 생략
//     // 결과 표시 밑에 ai 답변 표시

//     const ToolInvocationListView = memo(
//         ({ toolInvocations, message }: { toolInvocations: ToolInvocation[]; message: any }) => {
//             const renderToolInvocation = useCallback(
//                 (toolInvocation: ToolInvocation, index: number) => {
//                     const args = JSON.parse(JSON.stringify(toolInvocation.args));
//                             const result = 'result' in toolInvocation ? JSON.parse(JSON.stringify(toolInvocation.result)) : null;

//                             /// 생략


//             if (toolInvocation.toolName === 'web_search') {
//                 return (
//                     <div className="mt-4">
//                         <MultiSearch
//                             result={result}
//                             args={args}
//                             annotations={message?.annotations?.filter(
//                                 (a: any) => a.type === 'query_completion'
//                             ) || []}
//                         />
//                     </div>
//                 );
//             }

//             /// 생략

// ToolInvocationListView.displayName = 'ToolInvocationListView';
