/** "[A,-,L],\ [-,_,L]," -> [["A","-","L"],["-","_","L"]] */
export const descriptorToMap = (descriptor: string) =>
    Array.from(descriptor.replace(/[\\\s]/g, '').matchAll(/\[([^[\]]*)\]/g), match => match[1].split(',').filter(Boolean))
