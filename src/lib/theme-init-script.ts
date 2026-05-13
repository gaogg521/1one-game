import { DEFAULT_THEME, LEGACY_THEME_MAP, THEME_IDS } from "@/lib/themes";

const idsJson = JSON.stringify([...THEME_IDS]);
const legacyJson = JSON.stringify(LEGACY_THEME_MAP);

/** 首帧执行：与 1oneclaw 一致使用 localStorage「theme」；兼容旧「gc-theme」与旧 id */
export const THEME_INIT_SCRIPT = `(function(){
var k="theme",m=${idsJson},LEG=${legacyJson};
function apply(t){document.documentElement.setAttribute("data-theme",t);}
try{
  var g=localStorage.getItem("gc-theme");
  if(g){
    if(m.indexOf(g)>=0){apply(g);localStorage.setItem(k,g);localStorage.removeItem("gc-theme");return;}
    if(LEG[g]){localStorage.setItem(k,LEG[g]);localStorage.removeItem("gc-theme");apply(LEG[g]);return;}
  }
  var t=localStorage.getItem(k);
  if(t&&m.indexOf(t)>=0){apply(t);return;}
}catch(e){}
apply("${DEFAULT_THEME}");
})();`;
