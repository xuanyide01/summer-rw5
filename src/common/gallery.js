// The original game uses one numbered event ID for a scene's CG variants.
export function groupGallery(catalog){
  const groups=[],byId={};
  for(const item of catalog){
    const match=/^(cg|ef)_([a-z]+[0-9]+)_/i.exec(item.source);
    const id=match?match[1].toLowerCase()+'_'+match[2].toLowerCase():item.source.toLowerCase();
    let group=byId[id];
    if(!group){group={id,image:item.image,label:item.label,variants:[]};byId[id]=group;groups.push(group);}
    group.variants.push(item);
  }
  return groups;
}
export function stepVariant(index,delta,count){
  if(!Number.isInteger(count)||count<1)return 0;
  return ((index+delta)%count+count)%count;
}
