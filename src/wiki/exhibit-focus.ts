import { setControl } from './exhibit-controls.ts';

/** Move an existing exhibit into a dialog, keeping its state and SVG IDs intact. */
export function exhibitFocus(root:HTMLElement,label:string,signal:AbortSignal) {
  let dialog:HTMLDialogElement|undefined,placeholder:Comment|undefined;
  const wide=window.matchMedia('(min-width:950px)');
  const find=(selector:string)=>root.querySelector<HTMLElement>(selector)!;
  function placeControls(){find(dialog&&wide.matches?'.cannon-plot':'.cannon-workbench').append(find('.cannon-controls'));}
  function close(){
    if(!dialog)return;
    placeholder!.before(root);placeholder!.remove();placeholder=undefined;
    dialog.close();dialog.remove();dialog=undefined;root.classList.remove('is-focused');placeControls();
    const button=find('[data-focus]');setControl(button,'expand','Expand experiment');button.focus({preventScroll:true});
  }
  function toggle(){
    if(dialog){close();return;}
    placeholder=document.createComment('exhibit-position');root.before(placeholder);
    dialog=document.createElement('dialog');dialog.className='atlas cannon-focus-shell';dialog.setAttribute('aria-label',label);
    document.body.append(dialog);dialog.append(root);root.classList.add('is-focused');
    setControl(find('[data-focus]'),'collapse','Return to article');placeControls();dialog.showModal();
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();},{signal});
  }
  wide.addEventListener('change',()=>{if(dialog)placeControls();},{signal});
  return {toggle,close};
}
