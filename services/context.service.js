


export const buildContext = ({
  messages,
  retrievedChunks,
  question,
}) => {
   // ...


   return {
    'history':messages,
    'retrievedChunks':retrievedChunks,
    'question':question

    
   }


};