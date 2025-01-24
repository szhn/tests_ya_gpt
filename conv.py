import json
#Конвертер токенов берет 1 и 2 из 1:???:2
def convert_tokens_to_json(input_file, output_file):
    tokens_dict = {}
    
    with open(input_file, 'r', encoding='utf-8') as file:
        for line in file:
            line = line.strip()
            if line: 
                parts = line.split(':', 2)  
                if len(parts) == 3:
                    username, _, token = parts
                    tokens_dict[username] = token
                else:
                    print(f"Неверный формат строки: {line}")
    
    with open(output_file, 'w', encoding='utf-8') as json_file:
        json.dump(tokens_dict, json_file, ensure_ascii=False, indent=2)

input_file = 'tokens.txt'  
output_file = 'tokens2.json' 
convert_tokens_to_json(input_file, output_file)