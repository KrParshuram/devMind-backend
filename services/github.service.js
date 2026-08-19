

const githubHeaders = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export async function getRepoFiles (owner, name, branch) {

    console.log(
  "GitHub token available:",
  Boolean(process.env.GITHUB_TOKEN)
);

      const githubUrl = `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`;
    
      const response = await fetch(githubUrl, {
        headers: githubHeaders,
      });

      if(!response.ok){
        throw new Error(`HTTP Error with status:${response.status}`)
      }

      const data = await response.json();
      const ALLOWED = ['.js','.ts','.jsx','.tsx','.py','.md','.json','.yml','.yaml','.txt'];

        const filesOnly = data.tree
        .filter(item => item.type === 'blob')
        .filter(item => ALLOWED.some(ext => item.path.endsWith(ext)));

      return filesOnly;
    // return files list 
}

export async function getFileContent(owner, name, filePath){
    const githubUrl = `https://api.github.com/repos/${owner}/${name}/contents/${filePath}`;

        const response = await fetch(githubUrl, {
      headers: githubHeaders,
    });

    const data = await response.json();

    // after getting data, decode content:
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return content;

}


