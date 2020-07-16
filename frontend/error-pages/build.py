from typing import NamedTuple, Dict, List, Type
from os import makedirs, path


template_path = 'template.html'
result_path = 'built'

class Substitutions(NamedTuple):
    title: str
    description: str

error_messages: Dict[str, Substitutions] = {
    '403': Substitutions(
        title='403 - Forbidden',
        description='You are not allowed to view this resource.'
    ), 
    '404': Substitutions(
        title='404 - Not found',
        description='The requested resource cannot be found.'
    ), 
    '50x': Substitutions(
        title='50x - Server error',
        description='It\'s my fault.'
    ), 
}


def substitute(source: str, substitutions: Substitutions) -> str:
    for i, property_name in enumerate(Substitutions._fields):
        source = source.replace(f'{{{property_name}}}', str(substitutions[i]))
    return source


if __name__ == '__main__':
    with open(template_path) as f:
        template = f.read()

    makedirs(result_path, mode=0o440, exist_ok=True)

    for name, substitutions in error_messages.items():
        with open(path.join(result_path, f'{name}.html'), 'w') as f:
            html = substitute(template, substitutions)
            f.write(html)
