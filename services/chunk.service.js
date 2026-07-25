
function chunkText( text , chunkSize=500 , overlap= 100){

    const chunks = [];
    let start = 0;

    while(start < text.length){
        const end = start + chunkSize;
        chunks.push(text.slice(start , end));
        start = start + chunkSize - overlap; //move forward but overlap a bit 

    }

    return chunks;

}

export default chunkText;