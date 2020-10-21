const baseUri = 'https://insights.decla.red';
const type = 'decla-red-frontend';
const updateTime = 15000;

export const handleInsights = async (initialData: any, getFrameData: () => any) => {
  const sessionId = await createSession(initialData);
  setInterval(() => createFrame(sessionId, getFrameData()), updateTime);
};

const createSession = async (data: any): Promise<string> => {
  const response = await sendPostRequest(`${baseUri}/${type}/sessions/`, data);
  const { sessionId } = await response.json();
  return sessionId;
};

const createFrame = async (sessionId: string, data: any): Promise<unknown> =>
  await sendPostRequest(`${baseUri}/${type}/sessions/${sessionId}`, data);

const sendPostRequest = async (uri: string, data: any): Promise<Response> =>
  await fetch(uri, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
