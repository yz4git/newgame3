/** Class names change in the published bundle; Three's capability flag does
 * not. Checking the name can reject a working, canvas-owning WebGPU backend. */
export function isWebGPUBackend(backend:object){
 return 'isWebGPUBackend' in backend&&backend.isWebGPUBackend===true;
}
