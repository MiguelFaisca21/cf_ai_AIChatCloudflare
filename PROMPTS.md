FIRST QUESTION:

Help me generate a simple JSX code to append to the end of my REACT frontend code to support my AI Chat application. Please code a simple interface with a box to write messages, a send button for the user to submit queries to the AI worker, and finally some response bubbles for both the user questions and the AI responses. If possible, add a simple "AI is writing..." to the bottom of the AI bubble during the period that the request is send and when the response ends.

Also, to note that the worker that supports the other part of the application allows a user to establish a WebSocket connection, handles streaming AI messages (and sends back partial text as tokens until the response ends, which stops by the worker responding with an \n), allows stopping the AI mid-response, and provides an endpoint to fetch past messages via /history=?username. With this knowledge, try to add the necessary hooks as best as possible, so that I can then after adapt the code to my liking.

SECOND QUESTION:

Help me write a README file to help explain how to deploy my AI Chat application. It must include the following workflow:
- Deploying the Worker, which must install dependencies via npm, login to cloudflare via wrangler, deploying the application via wrangler, and obtain the workers URL to be used by the frontend;
- Deploying the Frontend, which must also install dependencies via npm, change a variable maintained in the src/config.ts file to the deployed worker's URL, and start the REACT frontend with npm start.
