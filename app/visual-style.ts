/** Reversible graphics pipeline. No gameplay or save data depends on this preference. */
export type VisualStyle='rebuilt'|'classic';
const KEY='nova-strike-visual-style-v3';
function fromStorage():VisualStyle {
 try{
  const url=new URLSearchParams(location.search).get('visual');
  if(url==='classic'||url==='rebuilt')return url;
  return localStorage.getItem(KEY)==='classic'?'classic':'rebuilt';
 }catch{return 'rebuilt';}
}
let chosen:VisualStyle=fromStorage();
export const currentVisualStyle=()=>chosen;
export const usesRebuiltGraphics=()=>chosen==='rebuilt';
export function setVisualStyle(style:VisualStyle){
 chosen=style;
 try{localStorage.setItem(KEY,style);}catch{/* localStorage is optional */}
}
export const visualStyleInfo={
 classic:'Original 2.9.3 atlas-based artwork',
 rebuilt:'Physical 3D ships, volumetric world landmarks and coherent materials'
} as const;
