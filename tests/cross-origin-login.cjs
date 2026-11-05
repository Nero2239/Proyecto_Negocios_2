// Run with node tests/cross-origin-login.cjs. CHROME_BIN can select a Chrome/Chromium executable.
const assert = require('node:assert/strict');
const fs=require('fs'),http=require('http'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const authSource=fs.readFileSync('js/auth.js','utf8');
const moduleSource=fs.readFileSync('js/access.js','utf8');
const sdk=`export const browserLocalPersistence={},browserSessionPersistence={},setPersistence=async()=>{},initializeApp=()=>({}),getApps=()=>[{}],getApp=()=>({}),getAuth=()=>({}),getFirestore=()=>({}),doc=()=>({}),collection=()=>({}),query=()=>({}),where=()=>({}),updateDoc=async()=>{},getDocs=async()=>({empty:false});export const signInWithEmailAndPassword=async()=>({user:{uid:'admin',email:'admin@example.test',emailVerified:true}});export const getDoc=async()=>({exists:()=>true,data:()=>({auth_uid:'admin',email:'admin@example.test',nombre:'Admin de prueba',rol:'admin'})});`;
let sourceOrigin;
const sourceServer=http.createServer((req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','text/javascript; charset=utf-8');
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/js/access.js')return res.end(moduleSource);
 if(url.pathname==='/sdk.js')return res.end(sdk);
 if(url.pathname==='/js/auth.js'){
  let source=authSource.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/12\.18\.0\/firebase-[a-z-]+\.js/g,sourceOrigin+'/sdk.js');
  return res.end(source);
 }
 res.statusCode=404;res.end();
});
const pageServer=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');res.setHeader('Content-Type','text/html; charset=utf-8');
 if(url.pathname==='/admin.html')return res.end(`<!doctype html><html><body><pre id="result"></pre><script>document.getElementById('result').textContent=JSON.stringify({signedIn:localStorage.getItem('isLoggedIn'),role:localStorage.getItem('userRole'),view:new URLSearchParams(location.search).get('view')});</script></body></html>`);
 res.end(`<!doctype html><html><body><form id="loginForm"><input id="loginEmail" value="admin@example.test"><input id="loginPassword" value="test-password"><input id="rememberCheck" type="checkbox"></form><div id="messageBox"></div><pre id="result">pending</pre><script src="${sourceOrigin}/js/access.js"></script><script src="${sourceOrigin}/js/auth.js?mode=${url.searchParams.get('mode')}"></script><script>const originalTimeout=window.setTimeout;window.setTimeout=(callback,delay,...args)=>delay===500?0:originalTimeout(callback,delay,...args);document.addEventListener('DOMContentLoaded',()=>{document.getElementById('loginForm').dispatchEvent(new Event('submit',{cancelable:true}));const timer=setInterval(()=>{const message=document.getElementById('messageBox').textContent;if(message.includes('Acceso verificado')){document.getElementById('result').textContent=JSON.stringify({signedIn:localStorage.getItem('isLoggedIn'),role:localStorage.getItem('userRole'),success:message});clearInterval(timer);}else if(message.includes('Failed to resolve')){document.getElementById('result').textContent=JSON.stringify({error:message});clearInterval(timer);}},10);});</script></body></html>`);
});
function listen(server){return new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));}
async function run(mode){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cross-origin-login-'));
 let target='http://127.0.0.1:'+pageServer.address().port+'/login.html?mode='+mode;
 if(mode==='file'){
  const fixture=path.join(temp,'Pagina local con espacios'); fs.mkdirSync(path.join(fixture,'js'),{recursive:true});
  const html=await (await fetch(target)).text();
  fs.writeFileSync(path.join(fixture,'login.html'),html.replaceAll(sourceOrigin+'/js/','js/'));
  fs.writeFileSync(path.join(fixture,'js','access.js'),moduleSource);
  fs.writeFileSync(path.join(fixture,'js','auth.js'),authSource.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/12\.18\.0\/firebase-[a-z-]+\.js/g,sourceOrigin+'/sdk.js'));
  target=require('url').pathToFileURL(path.join(fixture,'login.html')).href;
 }
 return new Promise(resolve=>{
 const browser=spawn(process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless','--no-sandbox','--disable-gpu','--in-process-gpu','--disable-software-rasterizer','--no-first-run','--disable-background-networking','--user-data-dir='+path.join(temp,'profile'),'--dump-dom','--virtual-time-budget=5000',target],{windowsHide:true});
 let output='',error='';browser.stdout.on('data',chunk=>output+=chunk);browser.stderr.on('data',chunk=>error+=chunk);const timeout=setTimeout(()=>browser.kill(),25000);browser.on('exit',code=>{clearTimeout(timeout);const match=output.match(/<pre id="result">([\s\S]*?)<\/pre>/);const result=match?match[1]:JSON.stringify({code,error:error.slice(-1000)});resolve({mode,result});});
 });
}
(async()=>{
 await listen(sourceServer); sourceOrigin='http://127.0.0.1:'+sourceServer.address().port; await listen(pageServer);
 try {
  for(const mode of ['cross-origin','file']) {
   const {result}=await run(mode); const data=JSON.parse(result);
   assert.equal(data.signedIn,'1',result); assert.equal(data.role,'admin',result);
   assert.match(data.success,/Acceso verificado/);
   console.log('PASS: actual auth.js signs in using '+mode+' scripts (mock Firebase).');
  }
 } finally { sourceServer.close(); pageServer.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
